var http = require('http');
var https = require('https');
var MongoClient = require('mongodb').MongoClient;
var pg = require('pg');
var pgConnStringParser = require('pg-connection-string').parse;
var Promise = require('promise');
var util = require('util');

var config = require('../config');
var foreign = require('./foreign');
var logger = require('../common/Logger').applicationWideLogger;

		

var mongodb = null;
var pgDataDB = null;
var pgGeonodeDB = null;
var objectId = null;



function request(options,dataToWrite,callback) {
	logger.info("conn#request Options: ", options);

	var time = new Date().getTime();
//	if (!options.headers || !options.headers['Authorization']) {
//		console.log('no auth',options.host);
//		if (options.host == config.geonodeHost || options.host == config.baseServer) {
//			options.headers = options.headers || {};
//			var auth = 'Basic ' + new Buffer(config.authUser + ':' + config.authPass).toString('base64');
//			options.headers['Authorization'] = auth;
//			console.log('auth set');
//		}
//	}

	var requestEngine = (["https","https:","https://"].indexOf(options.protocol)!=-1) ? https : http;

	delete options.protocol;

	var reqs = requestEngine.request(options, function(resl){
		var output = '';
		resl.setEncoding(options.resEncoding || 'utf8' );
		//console.log(resl.headers['geowebcache-cache-result'] || 'none');
		resl.on('data', function (chunk) {
			output += chunk;
		});
		resl.once('end', function() {
			return callback(null,output,resl);
		});
	});
	reqs.setMaxListeners(0);

	reqs.once('error',function(error) {
		return callback(error);
	});
	if (dataToWrite) {
		reqs.write(dataToWrite);
	}
	reqs.end();
	return reqs;
}


function initGeoserver() {
	var username = config.geoserverUsername;
	var password = config.geoserverPassword;
	var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
	var headers = {
		'Authorization': auth
	};
	var options = {
		host: config.geoserverHost,
		path: config.geoserverPath+'/web',
		headers: headers,
		port: config.geoserverPort,
		method: 'GET'
	};
	var jsid = null;
	request(options, null, function(err, output, resl) {
		if (err) {
			logger.error("conn#init Geoserver request error:", err, "\noutput:", output);
			return;
		}
		var cookies = resl.headers['set-cookie'] || [];
		for (var i=0;i<cookies.length;i++) {
			var cookie = cookies[i];
			if (cookie.search('JSESSIONID')>-1) {
				jsid = cookie.split(';')[0].split('=')[1];
				break;
			}
		}
		require('../api/proxy').setJsid(jsid);

	});
}

function initDatabases(pgDataConnString, pgGeonodeConnString, mongoConnString, callback) {
	pgDataDB = new pg.Client(pgDataConnString);
	pgDataDB.connect(function () {
		foreign.initForeignTables(getPgDataDb(), config.remoteDbSchemas);
	});
	pgGeonodeDB = new pg.Client(pgGeonodeConnString);
	pgGeonodeDB.connect();

	// keeping connection alive
	setInterval(function() {
		if (reconnectCommand) {
			clearInterval(reconnectCommand);
		}
		var reconnectCommand = setInterval(function() {
			if(!pgDataDB.activeQuery){
				clearInterval(reconnectCommand);
				pgDataDB.end();
				pgDataDB = new pg.Client(config.pgDataConnString);
				pgDataDB.connect();
				logger.info('conn#initDatabases Data DB reconnected');
			}else{
				logger.info('conn#initDatabases Data DB waiting for reconnect');
			}
		},2000);
	},Math.round(1000*60*60*5.9));

	setInterval(function() {
		if (reconnectCommand) {
			clearInterval(reconnectCommand);
		}
		var reconnectCommand = setInterval(function() {
			if(!pgGeonodeDB.activeQuery){
				clearInterval(reconnectCommand);
				pgGeonodeDB.end();
				pgGeonodeDB = new pg.Client(config.pgGeonodeConnString);
				pgGeonodeDB.connect();
				logger.info('conn#initDatabases Geonode DB reconnected');
			}else{
				logger.info('conn#initiDatabases Geonode DB waiting for reconnect');
			}
		},2000);
	},Math.round(1000*60*60*5.42));

	MongoClient.connect(mongoConnString, function(err, dbs) {
		if (err){
			return callback(err);
		}
		mongodb=dbs;
		var mongoSettings = mongodb.collection('settings');
		mongoSettings.findOne({_id:1},function(err,result) {
			objectId = result ? result.objectId : null;
			if (err || !objectId) return callback(err);
			callback();
		});
	});
}

function init(app, callback) {
	setInterval(function() {
		initGeoserver();
	},590000);
	initGeoserver();

	initDatabases(config.pgDataConnString, config.pgGeonodeConnString, config.mongoConnString, callback);

	//var server = require('http').createServer(app);
	//server.listen(3100);
}

function getIo() {
	return null;
	//return io;
}

function getNextId() {
	var newId = ++objectId;
	var mongoSettings = getMongoDb().collection('settings');
	mongoSettings.update({_id: 1}, {_id: 1,objectId: newId}, {upsert: true}, function() {});
	return newId;
}

function getMongoDb() {
	return mongodb;
}

function getPgDataDb() {
	return pgDataDB;
}
function getPgGeonodeDb() {
	return pgGeonodeDB;
}

function connectToPgDb(connectionString) {
	var pgDatabase = new pg.Client(connectionString);
	pgDatabase.connect();
	return pgDatabase;
}

function getSchemaName(workspaceName) {
	var schemaName = null;
	if (config.workspaceSchemaMap.hasOwnProperty(workspaceName)) {
		schemaName = workspaceSchemaMap[workspaceName];
	} else {
		var wMap = {}
		_.each(config.remoteDbSchemas, function (remoteServerOptions, remoteServerName) {
			_.each(remoteServerOptions.workspaceMap, function (mapItem, idx) {
				if (workspaceName == mapItem.workspace) {
					wMap[workspaceName] = mapItem.local_schema;
				}
			});
		});
		if (wMap.hasOwnProperty(workspaceName)) {
			schemaName = wMap[workspaceName];
		} else {
			logger.error(util.format("Error: workspace '%s' not found in any map.", workspaceName));
		}
	}
	return schemaName;
}

function getLayerTable(layerName) {
	// Extract workspaceName and tableName.
	var nameParts = layerName.split(":");
	var err_msg = "";
	if (nameParts.length != 2) {
		err_msg = util.format("Error: layerName does not keep the format 'workspace:table': '%s'.", nameParts);
		logger.error(err_msg);
		return null;
	}
	var workspaceName = nameParts[0];
	var tableName = nameParts[1];
	if (workspaceName == "" || tableName == "") {
		err_msg = util.format("Error: layerName has empty workspace or table: '%s'.", nameParts);
		logger.error(err_msg);
		return null;
	}

	// Do lookup for schema.
	var schemaName = getSchemaName(workspaceName);

	// Return schemaName.tableName optionaly without the schema part.
	if (schemaName == null) {
		return tableName;
	}
	return util.format("%s.%s", schemaName, tableName);
}

/**
 * Gets the name of the geometry column used by particular table.
 *
 * @param {string} sourceTableName - The name of the table holding the geometry column.
 *   The value must always keep the format "schemaName.tableName".
 * @return {string} Geometry column name.
 *   If the table has more geometry columns than the column returned is undefined.
 */
function getGeometryColumnName(sourceTableName) {
	return new Promise(function (resolve, reject) {
		// Extract schema name and table name.
		var nameParts = sourceTableName.split(".");
		var err_msg = "";
		if (nameParts.length != 2) {
			err_msg = util.format("Error: sourceTableName does not keep the format 'schema.table': '%s'.", nameParts);
			logger.error(err_msg);
			reject(new Error(err_msg));
		}
		var schemaName = nameParts[0];
		var tableName = nameParts[1];
		if (schemaName == "" || tableName == "") {
			err_msg = util.format("Error: sourceTableName has empty schema or table: '%s'.", nameParts);
			logger.error(err_msg);
			reject(new Error(err_msg));
		}
	
		// Do lookup.
		// geometry_columns is a view created by postgis.
		// Such view is one only per database and is located in the same schema where postgis extension is located.
		// Although it is one only it keeps geometry columns of all the tables throughout the database.
		// We do not want to search for the schema and we expect that such important view must be accessible by 'search_path'.
		//
		// FIXME:
		// Remove such dirty quick fix which is here to deal with situation where table has more than one geometry column.
		var sql = util.format("SELECT f_geometry_column FROM geometry_columns WHERE f_table_schema = $1 AND f_table_name = $2 AND f_geometry_column LIKE '%s';",
		                      config.geometryColumnNamePattern);
		var client = getPgDataDb();
		client.query(sql, [schemaName, tableName], function(err, results) {
			if (err) {
				err_msg = util.format("conn#getGeometryColumnName Sql. %s Error: ", sql, err);
				logger.error(err_msg);
				return reject(new Error(err_msg));
			}
			if (results.rows.length < 1) {
				err_msg = util.format("conn#getGeometryColumnName found no item for table %s.", sourceTableName);
				logger.error(err_msg);
				return reject(new Error(err_msg));
			}
			var colName = results.rows[0]['f_geometry_column'];
			resolve(colName);
		});
	});
}

module.exports = {
	init: init,
	getIo: getIo,
	request: request,
	connectToPgDb: connectToPgDb,
	initDatabases: initDatabases,
	getMongoDb: getMongoDb,
	getPgDataDb: getPgDataDb,
	getPgGeonodeDb: getPgGeonodeDb,
	getNextId: getNextId,
	getLayerTable: getLayerTable,
	getGeometryColumnName: getGeometryColumnName
};
