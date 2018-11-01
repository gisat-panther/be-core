const _ = require('lodash');
const uuid = require('uuid');
const fse = require('fs-extra');
const fs = require('fs');
const childProcess = require('child_process');

const WpsBaseProcess = require('../WpsBaseProcess');
const PucsMatlabProcessor = require('../../integration/PucsMatlabProcessor');
const DataLayerDuplicator = require('../../layers/DataLayerDuplicator');

class CalculatePragueTemperatureMapUsingNeuralNetworkModel extends WpsBaseProcess {
	constructor(pgPool, pantherTemporaryStoragePath, pantherDataStoragePath, pgSchema, mongo) {
		super();

		this._pgPool = pgPool;
		this._runningProcesses = {};
		this._pantherTemporaryStoragePath = pantherTemporaryStoragePath;
		this._pantherDataStoragePath = pantherDataStoragePath;
		this._pgSchema = pgSchema;
		this._mongo = mongo;

		this._describe = {
			identifier: `CalculatePragueTemperatureMapUsingNeuralNetworkModel`,
			title: `CalculatePragueTemperatureMapUsingNeuralNetworkModel`,
			abstract: `Calculate temperature map for Prague using neural network model by VITO`,
			inputs: {
				inputFile: {
					identifier: `inputFile`,
					title: `InputFile`,
					abstract: `Input for calculations. Is it possible to use multiple types of input paths. Input has to be esri shp file (wgs84) or zipped esri shape. Examples: "upload:uploadUuid", "ftp:[user:pass@]url-to-shp", "http:[user:password@]url-to-shp"`,
					dataType: `String`,
					unique: true,
					required: true
				}
			},
			outputs: {
				layers: {
					identifier: `layers`,
					title: `Layers`,
					abstract: `List of layers which contains input layers for pucs matlab processor and output layers generated by processor`,
					dataType: `application/json`
				}
			}
		};

		this._pucsMatlabProcessor = new PucsMatlabProcessor(`prague`, `/home/mbabic/matlab_ua_prague`, `/usr/local/MATLAB/MATLAB_Runtime/v901`, pgPool, pgSchema, mongo);
		this._dataLayerDuplicator = new DataLayerDuplicator();
	}

	execute(parsedRequest) {
		let processUuid = uuid();
		this._runningProcesses[processUuid] = {
			created: new Date(),
			input: null,
			output: null,
			progress: 0,
			process: this.name
		};

		return this._getInputMetadata(parsedRequest)
			.then((input) => {
				this._runningProcesses[processUuid].input = input;
				this._runningProcesses[processUuid].progress++;
				return this._prepareDataForMatlabProcessor(processUuid);
			})
			.then((processWorkDirectoryPath) => {
				this._runningProcesses[processUuid].progress++;
				return this._pucsMatlabProcessor.process(processWorkDirectoryPath, this._pantherDataStoragePath, parsedRequest.owner);
			})
			.then((layersJson) => {
				return [{
					identifier: `layers`,
					data: JSON.stringify(layersJson)
				}]
			});
	}

	_prepareDataForMatlabProcessor(processUuid) {
		return Promise.resolve()
			.then(() => {
				this._runningProcesses[processUuid].progress++;
				if (this._runningProcesses[processUuid].input.type === `uploadKey`) {
					return this._prepareLocalUploadForMatlabProcessor(processUuid);
				} else if (this._runningProcesses[processUuid].input.type === `remotePath`) {
					return this._prepareRemotePackageForMatlabProcessor(processUuid);
				} else if (this._runningProcesses[processUuid].input.type === `localLayer`) {
					return this._prepareLocalGeoserverLayerForMatlabProcessor(processUuid);
				} else {
					throw new Error(`Input type ${this._runningProcesses[processUuid].input.type} was not implemented yet.`);
				}
			});
	}

	_prepareLocalGeoserverLayerForMatlabProcessor(processUuid) {
		let localLayerName = this._runningProcesses[processUuid].input.data;
		return this._dataLayerDuplicator.getGeoserverShapeLayerDownloadUrlByLayerName(localLayerName)
			.then((remotePath) => {
				return this._dataLayerDuplicator.downloadFileFromRemote(remotePath);
			})
			.then((download) => {
				return this._dataLayerDuplicator.renameDownloadByContentType(download);
			})
			.then((result) => {
				return this._dataLayerDuplicator.unzipPackage(result);
			})
			.then((result) => {
				return this._dataLayerDuplicator.removeFile(result.input)
					.then(() => {
						return result;
					})
			})
			.then((result) => {
				return this._dataLayerDuplicator.renameFilesInDirectory(result.path)
					.then(() => {
						return result.path;
					})
			});
	}

	_prepareRemotePackageForMatlabProcessor(processUuid) {
		let remotePath = this._runningProcesses[processUuid].input.data;
		return this._dataLayerDuplicator.downloadFileFromRemote(remotePath)
			.then((download) => {
				return this._dataLayerDuplicator.renameDownloadByContentType(download);
			})
			.then((result) => {
				return this._dataLayerDuplicator.unzipPackage(result);
			})
			.then((result) => {
				return this._dataLayerDuplicator.removeFile(result.input)
					.then(() => {
						return result;
					})
			})
			.then((result) => {
				return this._dataLayerDuplicator.renameFilesInDirectory(result.path)
					.then(() => {
						return result.path;
					})
			});
	}

	_prepareLocalUploadForMatlabProcessor(processUuid) {
		let processWorkDirectoryPath = `${this._pantherTemporaryStoragePath}/${processUuid}`;
		return Promise.resolve()
			.then(() => {
				this._runningProcesses[processUuid].progress++;
				return fse.ensureDir(processWorkDirectoryPath);
			})
			.then(() => {
				this._runningProcesses[processUuid].progress++;
				return this._getLocalUploadMetadataByUuid(this._runningProcesses[processUuid].input.data);
			})
			.then((localUploadMetadata) => {
				this._runningProcesses[processUuid].progress++;
				if (localUploadMetadata.name.toLowerCase().endsWith('.zip')) {
					return this._extractZippedArchiveToDirectory(localUploadMetadata.path, processWorkDirectoryPath);
				} else if (localUploadMetadata.name.toLowerCase().endsWith('.shp')) {
					return fse.copy(localUploadMetadata.path, `${processWorkDirectoryPath}/${localUploadMetadata.name}`);
				} else {
					throw new Error('unsupported file type');
				}
			})
			.then(() => {
				return processWorkDirectoryPath;
			});
	}

	_extractZippedArchiveToDirectory(pathToArchive, destinationDirectory) {
		return new Promise((resolve, reject) => {
			let command = [
				`unzip`,
				`${pathToArchive}`,
				`-d ${destinationDirectory}`
			];
			childProcess.exec(command.join(` `), (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else if (stderr) {
					reject(stderr);
				} else {
					resolve();
				}
			});
		});
	}

	_getLocalUploadMetadataByUuid(localUploadUuid) {
		return Promise.resolve()
			.then(() => {
				let query = [];
				query.push(`SELECT`);
				query.push(`*`);
				query.push(`FROM`);
				query.push(`"${this._pgSchema}"."uploads"`);
				query.push(`WHERE`);
				query.push(`uuid = '${localUploadUuid}';`);

				return this._pgPool.query(query.join(` `))
					.then((queryResult) => {
						if (queryResult.rows) {
							return queryResult.rows[0];
						} else {
							throw new Error(`local upload with uuid ${localUploadUuid} was not found.`);
						}
					});
			});
	}

	_getInputMetadata(parsedRequest) {
		return Promise.resolve()
			.then(() => {
				let input = _.find(parsedRequest.dataInputs, {identifier: 'inputFile'});
				if (input) {
					let inputParts = input.data.split(':');
					return {
						type: inputParts.shift(),
						data: inputParts.join(':')
					}
				} else {
					throw new Error('unable to find data input "inputFile"');
				}
			});
	}
}

CalculatePragueTemperatureMapUsingNeuralNetworkModel.prototype.name = 'CalculatePragueTemperatureMapUsingNeuralNetworkModel';

module.exports = CalculatePragueTemperatureMapUsingNeuralNetworkModel;