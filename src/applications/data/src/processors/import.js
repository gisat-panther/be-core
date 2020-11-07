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

const importVerifiedFiles = (importKey, verifiedFiles) => {
	let imports = [];
	_.forIn(verifiedFiles, (value, name) => {
		if (_.isArray(value)) {
			imports.push(
				importESRIShapefile(importKey, name, value)
			)
		} else if (_.isObject(value) && value.type === "gpkg") {
			imports.push(
				processGeoPackage(importKey, value)
			)
		}
	})

	return Promise.all(imports);
}

const importESRIShapefile = (importKey, name, files) => {

}

const importGeoPackage = (importKey, path) => {
	let {host, user, password, database} = config.pgConfig.normal;
	return new Promise((resolve, reject) => {
		chp.exec(
			`ogr2ogr -f "PostgreSQL" "PG:host=${host} user=${user} password=${password} dbname=${database}" -lco LAUNDER=NO ${path}`,
			(error, stdout, stderr) => {
				resolve();
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
	return Promise
		.resolve()
		.then(() => {
			return getGeoPackageLayerNames(path);
		})
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
			return importGeoPackage(importKey, path)
		})
}

const getGeoPackageLayerNames = (path) => {
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

const importFile = (file, user) => {
	if (file.mimetype !== "application/zip") {
		throw new Error("unsupported package type, zip file expected")
	}

	let importKey, files, verifiedFiles;
	return extractPackage(file)
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
			return importVerifiedFiles(importKey, verifiedFiles);
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

module.exports = (file, user) => {
	return importFile(file, user);
}