const admZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const chp = require('child_process');
const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const config = require('../../../../../config');

const cache = require('../../../../cache');
const db = require('../../../../db');
db.init();

const basePath = "/tmp/ptr_import_";

const cleanUp = (importKey) => {
	return new Promise((resolve, reject) => {
		fs.rmdir(`${basePath}${importKey}`, {recursive: true}, () => {
			log(importKey, "cleaned up");
			resolve();
		})
	});
}

const extractPackage = (file, importKey) => {
	return Promise
		.resolve()
		.then(() => {
			let zipFs = new admZip(_.isObject(file) ? file.buffer : file);
			zipFs.extractAllTo(`${basePath}${importKey}`, true);
		})
		.then(() => {
			log(importKey, "package extracted");
		})
}

const getFiles = (importKey) => {
	return new Promise((resolve, reject) => {
		let files = fs.readdir(`${basePath}${importKey}`, (error, files) => {
			if (error) {
				reject(error);
			} else {
				resolve(files);
			}
		})
	})
}

const importVerifiedFiles = (importKey, verifiedFiles, options) => {
	let imports = [];
	_.forIn(verifiedFiles, (value, name) => {
		if (_.isArray(value)) {
			imports.push(
				processShapefile(importKey, name, value, options)
			)
		} else if (_.isObject(value) && value.type === "gpkg") {
			imports.push(
				processGeoPackage(importKey, value, options)
			)
		}
	})

	return Promise.all(imports);
}

const importSpatialDataToPostgres = (importKey, path) => {
	let {host, user, password, database} = config.pgConfig.normal;
	return new Promise((resolve, reject) => {
		chp.exec(
			`ogr2ogr -f "PostgreSQL" "PG:host=${host} user=${user} password=${password} dbname=${database}" -nlt PROMOTE_TO_MULTI -lco SPATIAL_INDEX=GIST -lco GEOMETRY_NAME=geom -lco LAUNDER=NO ${path}`,
			(error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else if (stderr) {
					reject(new Error(stderr));
				} else {
					resolve();
				}
			});
	})
}

const getExistingLayers = (layerNames) => {
	return db
		.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('${layerNames.join("', '")}')`)
		.then((pgResult) => {
			return _.map(pgResult.rows, "table_name");
		})
}

const processGeoPackage = (importKey, options) => {
	let path = `${basePath}${importKey}/${options.file}`;
	let layerNames;
	return getLayerNamesFromPath(path)
		.then((pLayerNames) => {
			layerNames = pLayerNames;
		})
		.then(() => {
			return getExistingLayers(layerNames)
				.then((existingLayers) => {
					if (existingLayers.length) {
						throw new Error(`${existingLayers.join(", ")} already exists`)
					}
				})
		})
		.then(() => {
			return importSpatialDataToPostgres(importKey, path)
		})
}

const processShapefile = (importKey, name, files, options) => {
	let shp = _.find(files, (file) => {
		return file.toLowerCase().endsWith(".shp");
	});

	let path = `${basePath}${importKey}/${shp}`;

	return Promise
		.resolve()
		.then(() => {
			if (options && options.overwrite) {
				return clearLayerData(name)
					.then(() => {
						log(importKey, `existing data for layer ${name} cleared out`);
					})
			}
		})
		.then(() => {
			return getExistingLayers([name])
		})
		.then((existingLayers) => {
			if (existingLayers.length) {
				throw new Error(`${existingLayers.join(", ")} already exists`)
			}
		})
		.then(() => {
			return importSpatialDataToPostgres(importKey, path)
				.then(() => {
					log(importKey, `layer ${name} created`);
				})
		})
		.then(() => {
			if (options && options.topology) {
				return createTopologyForLayer(name, options)
					.then(() => {
						log(importKey, `topology for ${name} created and verified`);
					})
			}
		})
		.then(() => {
			if (options && options.tiled) {
				return createTilesForLayer(name, options)
					.then(() => {
						log(importKey, `tiles for ${name} calculated`)
					})
			}
		})
}

const clearLayerData = (layerName) => {
	return Promise
		.resolve()
		.then(() => {
			return db.query(`SELECT DropTopology('topo_${layerName}')`)
				.catch(() => {
				});
		})
		.then(() => {
			return db.query(`DROP TABLE "${layerName}" CASCADE`)
				.catch(() => {
				})
		})
		.then(() => {
			return db.query(`DROP TABLE "${layerName}_simple" CASCADE`)
				.catch(() => {
				})
		})
		.then(() => {
			return db.query(`DROP SCHEMA "topo_${layerName}" CASCADE`)
				.catch(() => {
				})
		})
}

const createTopologyForLayer = (layerName, options) => {
	let srid = options.srid;
	let precision = options.precision;
	let hasz = options.hasz || false

	return Promise
		.resolve()
		.then(() => {
			if (!srid) {
				throw new Error("srid option is missing")
			}
			if (!precision) {
				throw new Error("precision option is missing")
			}
		})
		.then(() => {
			return db.query(`SELECT CreateTopology('topo_${layerName}', ${srid}, ${precision}, ${hasz})`)
		})
		.then(() => {
			return db.query(`SELECT AddTopoGeometryColumn('topo_${layerName}', 'public', '${layerName}', 'topo', 'POLYGON')`)
		})
		.then((pgResult) => {
			let topoLayerId = pgResult.rows[0].addtopogeometrycolumn;
			return db.query(`UPDATE "${layerName}" SET "topo" = toTopoGeom("geom", 'topo_${layerName}', ${topoLayerId})`)
		})
		.then(() => {
			return db.query(`SELECT * FROM  ValidateTopology('topo_${layerName}');`)
				.then((pgResult) => {
					if (pgResult.rows && pgResult.rows.length) {
						throw new Error(_.map(pgResult.rows, 'error').join(", "));
					}
				})
		})
}

const createTilesForLayer = (layerName, options) => {
	if (!options.fidColumnName) {
		throw new Error(`missing fidColumnName options`);
	}

	return db
		.query(
			`ALTER TABLE "${layerName}" ADD CONSTRAINT "${layerName}_${options.fidColumnName}_unique" UNIQUE ("${options.fidColumnName}")`
		)
		.then(() => {
			return db
				.query(
					`SELECT 
					"data_type" AS "fidColumnType" 
					FROM "information_schema"."columns" 
					WHERE "table_name" = '${layerName}' 
					AND "column_name" = '${options.fidColumnName}'`
				)
		})
		.then((pgResult) => {
			return pgResult.rows[0].fidColumnType;
		})
		.then((fidColumnType) => {
			return db
				.query(
					`BEGIN;
					CREATE TABLE "${layerName}_simple" (
					"${options.fidColumnName}" ${fidColumnType} REFERENCES "${layerName}" ("${options.fidColumnName}"),
					"level" INT,
					"json" TEXT,
					UNIQUE ("${options.fidColumnName}", "level")
					);
					CREATE INDEX ON "${layerName}_simple" ("level");
					COMMIT;`
				)
		})
		.then(async () => {
			const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;

			const hasTopo = await db
				.query(`SELECT EXISTS(SELECT * FROM "information_schema"."columns" WHERE "table_name" = '${layerName}' AND "column_name" = 'topo')`)
				.then((pgResult) => {
					return pgResult.rows[0].exists;
				})

			let runs = 0;

			for (let level = 0; level <= 25; level++) {
				const gridSize = ptrTileGrid.utils.getGridSizeForLevel(level);
				const precision = gridSize / tileSize;

				Promise
					.resolve()
					.then(() => {
						runs++;
					})
					.then(() => {
						return db.query(
							`INSERT INTO "${layerName}_simple" 
							SELECT 
							"${options.fidColumnName}", 
							'${level}',
							${hasTopo ? `ST_AsGeoJSON(topology.st_simplify("topo", ${precision}))` : `ST_AsGeoJSON(ST_Simplify("geom", ${precision}))`} 
							FROM "${layerName}"`
						)
					})
					.then(() => {
						runs--;
					})

				await new Promise((resolve) => {
					let interval = setInterval(() => {
						if (runs < 2) {
							clearInterval(interval);
							resolve();
						}
					}, 1);
				})
			}
		})
		.then(() => {
			return db
				.query(`VACUUM ANALYZE "${layerName}_simple";`)
		})
}

const getLayerNamesFromPath = (path) => {
	return new Promise((resolve, reject) => {
		chp.exec(
			`ogrinfo -q ${path}`,
			(error, stdout, stderr) => {
				if (error) {
					reject(error);
				}

				let layerNames = [];
				let lines = stdout.split("\n");

				_.each(lines, (line) => {
					let match = line.match(/^[0-9]{1,2}: ([a-z0-9_A-Z]+) .*$/);
					if (match && match.length && match[1]) {
						layerNames.push(match[1]);
					}
				})

				resolve(layerNames);
			})
	})
}

const verifyFiles = (files) => {
	let verifiedFiles = {};
	_.each(files, (file) => {
		let extName = path.extname(file);
		let baseName = path.basename(file, extName);

		if (extName.toLowerCase() === ".shp") {
			let relatedFiles = _.filter(files, (relatedFile) => {
				return relatedFile.startsWith(baseName);
			});

			let dbf = _.find(relatedFiles, (relatedFile) => {
				return path.extname(relatedFile).toLowerCase() === ".dbf";
			})

			let prj = _.find(relatedFiles, (relatedFile) => {
				return path.extname(relatedFile).toLowerCase() === ".prj";
			})

			let shx = _.find(relatedFiles, (relatedFile) => {
				return path.extname(relatedFile).toLowerCase() === ".shx";
			})

			if (dbf && prj && shx) {
				verifiedFiles[baseName] = relatedFiles;
			}
		} else if (extName.toLowerCase() === ".gpkg") {
			verifiedFiles[baseName] = {
				type: "gpkg",
				file
			};
		}
	});

	if (!_.keys(verifiedFiles).length) {
		throw new Error("no valid spatial file was found");
	}

	return Promise.resolve(verifiedFiles);
}

const importFile = (file, user, options) => {
	let files, verifiedFiles;
	let importKey = crypto.randomBytes(16).toString("hex");

	log(importKey, "started");

	cache.set(`import_${importKey}`, {status: "running"})
		.then(() => {
			if (
				file
				&& file.mimetype === "application/zip"
			) {
				return extractPackage(file, importKey);
			} else if (
				options.fs
				&& fs.existsSync(options.fs)
				&& chp.execSync(`file --mime-type -b "${options.fs}"`).toString().trim() === "application/zip"
			) {
				return extractPackage(options.fs, importKey)
			} else {
				throw new Error("File not found or has unsupported type!")
			}
		})
		.then(() => {
			return getFiles(importKey)
				.then((pFiles) => {
					files = pFiles;
				})
		})
		.then(() => {
			return verifyFiles(files)
				.then((pVerifiedFiles) => {
					verifiedFiles = pVerifiedFiles;
				})
				.then(() => {
					log(importKey, "files verified");
				})
		})
		.then(() => {
			return importVerifiedFiles(importKey, verifiedFiles, options);
		})
		.then(() => {
			log(importKey, `done`);
			return cache.set(`import_${importKey}`, {status: "done"});
		})
		.catch((error) => {
			log(importKey, `failed with error ${error.message}`);
			return cache.set(`import_${importKey}`, {status: "failed", message: error.message});
		})
		.finally(() => {
			return cleanUp(importKey);
		})

	return Promise
		.resolve({
			importKey,
			statusPath: `${config.url}/rest/data/import/status/${importKey}`
		});
}

const log = (importKey, message) => {
	console.log(`#IMPORT# ${new Date().toISOString()} | ${importKey} | ${message}`);
}

module.exports = (file, user, options) => {
	return importFile(file, user, options);
}