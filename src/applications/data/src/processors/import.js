const admZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const chp = require('child_process');

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
			let zipFs = new admZip(file.buffer);
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
			`ogr2ogr -f "PostgreSQL" "PG:host=${host} user=${user} password=${password} dbname=${database}" -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom -lco LAUNDER=NO ${path}`,
			(error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else if (stderr) {
					reject(new Error(stderr));
				} else {
					resolve();
				}
			});
	});
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
			if (file.mimetype !== "application/zip") {
				throw new Error("unsupported package type, zip file expected")
			}
		})
		.then(() => {
			return extractPackage(file, importKey);
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
	console.log(`#IMPORT# ${importKey} ${message}`);
}

module.exports = (file, user, options) => {
	return importFile(file, user, options);
}