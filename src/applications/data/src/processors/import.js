const admZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const fse = require('fs-extra');
const fsp = require('fs/promises');
const path = require('path');
const _ = require('lodash');
const chp = require('child_process');
const ptrTileGrid = require('@gisatcz/ptr-tile-grid');
const { exec } = require('child_process');

const config = require('../../../../../config');

const cache = require('../../../../cache');
const db = require('../../../../db');
const query = require('../../../../modules/rest/query');
const mapserver = require('../../../../modules/map/mapserver');

const basePath = "/tmp/ptr_import_";

const rasterStaticPath = config.mapserver.storagePath || `/srv/static`;
const mapFileStaticPath = config.mapserver.mapsPath || `/srv/msmaps`;

const validFileExtensions = [".tif", ".style"];

const cleanUp = (importKey) => {
	return new Promise((resolve, reject) => {
		fs.rm(`${basePath}${importKey}`, { recursive: true }, () => {
			log(importKey, "cleaned up");
			resolve();
		})
	});
}

async function inspectFolder(folder, importKey) {
	await fse.ensureDir(`${basePath}${importKey}`);

	const files = await fse.readdir(folder);

	for (let file of files) {
		const fileExt = path.extname(file).toLowerCase();

		if (validFileExtensions.includes(fileExt)) {
			await fse.ensureSymlink(`${folder}/${file}`, `${basePath}${importKey}/${file}`);
		}
	}
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
		fs.readdir(`${basePath}${importKey}`, (error, files) => {
			if (error) {
				reject(error);
			} else {
				resolve(files);
			}
		})
	})
}

const importVerifiedFiles = async (importKey, verifiedFiles, options) => {
	for (const [name, value] of Object.entries(verifiedFiles)) {
		if (value && value.type === "shp") {
			await processVector(importKey, name, value, options);
		} else if (value && value.type === "gpkg") {
			await processGeoPackage(importKey, value, options);
		} else if (value && value.type === "raster") {
			await processRaster(importKey, value, options);
		} else if (value && value.type === "msmap") {
			await processMsMapFile(importKey, value, options);
		} else if (value && value.type === "geojson") {
			await processVector(importKey, name, value, options);
		} else if (value && value.type === "json") {
			await processJson(importKey, name, value, options);
		}
	}
}

const importVectorDataToPostgres = (importKey, path) => {
	let { host, user, password, database, port = 5432 } = config.pgConfig.normal;
	return new Promise((resolve, reject) => {
		chp.exec(
			`ogr2ogr -f "PostgreSQL" "PG:host=${host} user=${user} password=${password} dbname=${database} port=${port}" -nlt PROMOTE_TO_MULTI -lco SPATIAL_INDEX=GIST -lco GEOMETRY_NAME=geom -lco LAUNDER=NO ${path}`,
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
		.query(`SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('${layerNames.join("', '")}')`)
		.then((pgResult) => {
			return _.map(pgResult.rows, "table_name");
		})
}

const ensureRasterFsStructure = () => {
	return Promise
		.resolve()
		.then(() => {
			return fse.ensureDir(rasterStaticPath);
		})
		.then(() => {
			return fse.ensureDir(mapFileStaticPath);
		})
}

const reProjectRasterFile = (source, output, srid) => {
	return new Promise((resolve, reject) => {
		exec(`gdalwarp -t_srs epsg:${srid} -of vrt ${source} ${output}`, async (error) => {
			const parsedPath = path.parse(source);
			const folder = parsedPath.dir;
			const basename = parsedPath.name;
			await clearFiles(folder, basename, [parsedPath.ext, path.parse(output).ext]);

			if (error) {
				reject(error);
			} else {
				resolve(output);
			}
		})
	})
}

const optimizeRasterFile = (source, output) => {
	return new Promise((resolve, reject) => {
		exec(`gdal_translate -co COMPRESSED=YES -of HFA ${source} ${output}`, async (error) => {
			const parsedPath = path.parse(source);
			const folder = parsedPath.dir;
			const basename = parsedPath.name;
			await clearFiles(folder, basename, [parsedPath.ext, path.parse(output).ext]);

			if (error) {
				reject(error);
			} else {
				resolve(output);
			}
		})
	})
}

async function clearFiles(folder, basename, exceptionsByExt) {
	const files = await fsp.readdir(folder);
	for (const file of files) {
		const fileBasename = path.parse(file).name;
		const fileExt = path.parse(file).ext;

		if (fileBasename.startsWith(basename) && !exceptionsByExt.includes(fileExt)) {
			await fsp.rm(`${folder}/${file}`);
		}
	}
}

const processMsMapFile = (importKey, data, options) => {
	const sourcePath = `${basePath}${importKey}/${data.file}`;
	return Promise
		.resolve()
		.then(() => {
			return ensureRasterFsStructure();
		})
		.then(() => {
			if (!options.overwrite && fs.existsSync(`${mapFileStaticPath}/${data.file}`)) {
				throw new Error(`File ${data.file} already exists!`)
			}
		})
		.then(() => {
			return new Promise((resolve, reject) => {
				fs.copyFile(sourcePath, `${mapFileStaticPath}/${data.file}`, (error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				})
			})
		})
}

const processRaster = (importKey, data, options) => {
	const sourcePath = `${basePath}${importKey}/${data.file}`;
	const srid = options.srid || 4326;

	return Promise
		.resolve()
		.then(() => {
			return ensureRasterFsStructure();
		})
		.then(() => {
			if (!options.overwrite && fs.existsSync(`${rasterStaticPath}/${data.file}`)) {
				throw new Error(`File ${data.file} already exists!`)
			}
		})
		.then(() => {
			return reProjectRasterFile(
				sourcePath,
				`${basePath}${importKey}/${path.basename(data.file, '.tif')}_epsg${srid}.vrt`,
				srid
			)
		})
		.then(async (vrtFile) => {
			const optimizedFile = await optimizeRasterFile(
				vrtFile,
				`${basePath}${importKey}/${path.basename(data.file, '.tif')}_epsg${srid}.img`
			)

			return [vrtFile, optimizedFile];
		})
		.then(async ([vrtFile, optimizedFile]) => {
			let fileName = path.basename(optimizedFile);
			let destination = `${rasterStaticPath}/${fileName}`;
			await fse.copy(optimizedFile, destination);
			await fse.unlink(optimizedFile);
			await fse.unlink(vrtFile);

			return destination;
		})
		.then(async (finalFile) => {
			const name = path.parse(sourcePath).name;
			const projection = `EPSG:${srid}`;

			let styles = [];
			if (data.related && data.related.style) {
				styles = await fse.readJSON(`${basePath}${importKey}/${data.related.style}`);
			}

			const mapfile = mapserver.getMapfileString({
				name: `map_${name}`,
				projection,
				layers: [{
					name: `ptr_${name}`,
					status: true,
					data: finalFile,
					type: "RASTER",
					projection,
					styles
				}]
			});

			await fse.outputFile(`${mapFileStaticPath}/${name}.map`, mapfile);

			log(importKey, `file ${data.file} was processed!`);
		})
}

const processGeoPackage = (importKey, data) => {
	let path = `${basePath}${importKey}/${data.file}`;
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
			return importVectorDataToPostgres(importKey, path)
		})
}

const processVector = (importKey, name, data, options) => {
	let path = `${basePath}${importKey}/${data.file}`;

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
			return importVectorDataToPostgres(importKey, path)
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
			if (options && options.simple) {
				return createSimpleLayer(name, options)
					.then(() => {
						log(importKey, `layer ${name} simplified`)
					})
			}
		})
}

const processJson = async (importKey, name, data, options) => {
	const path = `${basePath}${importKey}/${data.file}`;
	const json = await fse.readJson(path);

	return db
		.transactional(async (client) => {
			if (options.overwrite) {
				await client.query(`DROP TABLE IF EXISTS "${name}" CASCADE;`);
			}

			const sql = [];
			sql.push(`CREATE TABLE "${name}" (`);

			let index = 0;
			_.forOwn(json[0], (value, property) => {
				sql.push(`${index++ ? ', ' : ''}"${property}" ${typeof value === "number" ? 'NUMERIC' : 'TEXT'} ${property === options.fidColumnName ? 'PRIMARY KEY' : ''}`)
			})

			sql.push(`);`)

			await client.query(sql.join(" "));

			for (const jsonLine of json) {
				const values = [];
				const columns = [];

				for (const property of _.keys(jsonLine)) {
					columns.push(`"${property}"`);
					values.push(`${typeof jsonLine[property] === "number" ? `${jsonLine[property]}` : `'${jsonLine[property]}'`}`);
				}

				await client.query(`INSERT INTO "${name}" (${columns.join(", ")}) VALUES (${values.join(", ")})`);
			}

			for (const property of _.keys(json[0])) {
				if (property !== options.fidColumnName) {
					await client.query(`CREATE INDEX ON "${name}" ("${property}")`);
				}
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
			return db.query(`UPDATE "${layerName}"
                             SET "topo" = toTopoGeom("geom", 'topo_${layerName}', ${topoLayerId})`)
		})
		.then(() => {
			return db.query(`SELECT *
                             FROM ValidateTopology('topo_${layerName}');`)
				.then((pgResult) => {
					if (pgResult.rows && pgResult.rows.length) {
						throw new Error(_.map(pgResult.rows, 'error').join(", "));
					}
				})
		})
}

const createSimpleLayer = (layerName, options) => {
	if (!options.fidColumnName) {
		throw new Error(`missing fidColumnName options`);
	}

	return db
		.query(
			`ALTER TABLE "${layerName}"
                ADD CONSTRAINT "${layerName}_${options.fidColumnName}_unique" UNIQUE ("${options.fidColumnName}")`
		)
		.then(() => {
			return db
				.query(
					`SELECT "data_type" AS "fidColumnType"
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
				.query(`SELECT EXISTS(SELECT *
                                      FROM "information_schema"."columns"
                                      WHERE "table_name" = '${layerName}'
                                        AND "column_name" = 'topo')`)
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
                             SELECT "${options.fidColumnName}",
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

function getRelatedFiles(baseName, files) {
	return _.filter(files, (relatedFile) => {
		return relatedFile.startsWith(baseName);
	});
}

const verifyFiles = (files) => {
	let verifiedFiles = {};
	_.each(files, (file) => {
		let extName = path.extname(file);
		let baseName = path.basename(file, extName);

		if (extName.toLowerCase() === ".shp") {
			let relatedFiles = getRelatedFiles(baseName, files);

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
				verifiedFiles[baseName] = {
					type: "shp",
					file: file,
					related: {
						dbf,
						prj,
						shx
					}
				};
			}
		} else if (extName.toLowerCase() === ".gpkg") {
			verifiedFiles[baseName] = {
				type: "gpkg",
				file
			};
		} else if (extName.toLowerCase() === ".tif") {
			let relatedFiles = getRelatedFiles(baseName, files);

			let style = _.find(relatedFiles, (relatedFile) => {
				return path.extname(relatedFile).toLowerCase() === ".style";
			})

			verifiedFiles[baseName] = {
				type: "raster",
				file,
				related: {
					style
				}
			};
		} else if (extName.toLowerCase() === ".map") {
			verifiedFiles[baseName] = {
				type: "msmap",
				file
			};
		} else if (extName.toLowerCase() === ".geojson") {
			verifiedFiles[baseName] = {
				type: "geojson",
				file
			};
		} else if (extName.toLowerCase() === ".json") {
			verifiedFiles[baseName] = {
				type: "json",
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

	cache.set(`import_${importKey}`, { status: "running" })
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
			} else if (
				options.fs
				&& fs.existsSync(options.fs)
				&& chp.execSync(`file --mime-type -b "${options.fs}"`).toString().trim() === "inode/directory"
			) {
				return inspectFolder(options.fs, importKey)
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
			return cache.set(`import_${importKey}`, { status: "done" });
		})
		.catch((error) => {
			log(importKey, `failed with error ${error.message}`);
			return cache.set(`import_${importKey}`, { status: "failed", message: error.message });
		})
		.finally(() => {
			return cleanUp(importKey);
		})

	return Promise
		.resolve({
			importKey,
			statusPath: `${config.url}/rest/import/status/${importKey}`
		});
}

const importMetadataByGroupType = async (group, type, metadata) => {
	await db
		.transactional(async (client) => {
			await query.deleteRecords({ group, type, client }, metadata);
			await query.create({ group, type, client }, metadata);
		})
}

const importMetadataByGroup = async (group, metadata, user) => {
	for (const type of _.keys(metadata)) {
		await importMetadataByGroupType(group, type, metadata[type], user);
	}
}

const importMetadataForEach = async (metadata, user) => {
	for (const group of _.keys(metadata)) {
		await importMetadataByGroup(group, metadata[group], user);
	}
}

const importMetadata = (metadata, user) => {
	let importKey = crypto.randomBytes(16).toString("hex");

	log(importKey, "started");

	cache.set(`import_${importKey}`, { status: "running" })
		.then(() => {
			return importMetadataForEach(metadata, user);
		})
		.then(() => {
			log(importKey, `done`);
			return cache.set(`import_${importKey}`, { status: "done" });
		})
		.catch((error) => {
			log(importKey, `failed with error ${error.message}`);
			return cache.set(`import_${importKey}`, { status: "failed", message: error.message });
		})

	return Promise
		.resolve({
			importKey,
			statusPath: `${config.url}/rest/import/status/${importKey}`
		});
}

const log = (importKey, message) => {
	console.log(`#IMPORT# ${new Date().toISOString()} | ${importKey} | ${message}`);
}

module.exports = {
	data: (file, user, options) => {
		return importFile(file, user, options);
	},
	metadata: (metadata, user) => {
		return importMetadata(metadata, user);
	}
}