const admZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const chp = require('child_process');

const config = require('../../../../../config');

const db = require('../../../../db');
db.init();

const basePath = "/tmp/ptr_import_";

const cleanUp = (importKey) => {
	return new Promise((resolve, reject) => {
		fs.rmdir(`${basePath}${importKey}`, {recursive: true}, () => {
			console.log(`Import ${importKey} cleaned!`);
			resolve();
		})
	});
}

const extractPackage = (file) => {
	let importKey = crypto.randomBytes(16).toString("hex");

	let zipFs = new admZip(file.buffer);

	zipFs.extractAllTo(`${basePath}${importKey}`, true);

	return Promise.resolve(importKey);
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
				return clearLayerData(name);
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
			return importSpatialDataToPostgres(importKey, path);
		})
		.then(() => {
			if (options && options.topology) {
				return createTopologyForLayer(name, options);
			}
		})
}

const clearLayerData = (layerName) => {
	return Promise.allSettled([
		db.query(`SELECT DropTopology('topo_${layerName}')`),
		db.query(`DROP TABLE "${layerName}" CASCADE`)
	])
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
	let importKey, files, verifiedFiles;
	return Promise
		.resolve()
		.then(() => {
			if (file.mimetype !== "application/zip") {
				throw new Error("unsupported package type, zip file expected")
			}
		})
		.then(() => {
			return extractPackage(file);
		})
		.then((key) => {
			if (!key) {
				throw new Error("unable to extract package")
			}
			importKey = key;
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
		})
		.then(() => {
			return importVerifiedFiles(importKey, verifiedFiles, options);
		})
		.then(() => {
			return cleanUp(importKey)
		})
		.catch((error) => {
			if (importKey) {
				return cleanUp(importKey)
					.then(() => {
						throw error;
					})
			} else {
				throw error;
			}
		})
}

module.exports = (file, user, options) => {
	return importFile(file, user, options);
}