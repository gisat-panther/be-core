var express = require('express');
var app = express();
var conn = require('./common/conn');
var publicConfig = require('./common/public-config');
var getCSS = require('./common/get-css');
var getMngCSS = require('./common/get-mng-css');
var staticFn = express['static'];
var session = require('express-session');

var async = require('async');
var loc = require('./common/loc');
var logger = require('./common/Logger').applicationWideLogger;

var config = require('./config');

process.on('uncaughtException', function (err) {
	logger.error("Caught exception: ", err);
});

function initServer(err) {
	logger.info('server#initServer Initialize the server.');

	if (err) {
		console.log('Error: while initializing server: ', err);
		return;
	}
	// Order is important

	// Log the requests to see when the error occurs.
	app.use(function(req, res, next) {
		logger.info("Request: "+ req.method + " - " + req.url);
		next();
	});

	app.use('/app.css', getCSS);
	app.use('/app-mng.css', getMngCSS);

	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(function(req, res, next){
		req.ssid = req.cookies.ssid || req.ssid || '';
		next();
	});
	app.use(loc.langParser);
    
	// Allow CORS on the node level.
    app.use(function(req, res, next) {
		// Allow CORS from anywhere.
		// TODO: Fix security issues.
		var url = req.headers.origin || 'http://localhost:63342';
		res.header("Access-Control-Allow-Origin", url);
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, access-control-allow-credentials, access-control-allow-origin, content-type, cookie");
		res.header("Access-Control-Allow-Credentials", true);
		res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS, DELETE");
		next();
    });
    // End of allow CORS.
	
	require('./routes/security')(app);
	require('./routes/routes')(app);
	require('./routes/finish')(app);
	require('./routes/iprquery')(app);
	app.use('/', staticFn(__dirname + '/public'));
	app.use('/ipr', staticFn(__dirname + '/public/ipr'));

	console.log('Going to listen on port ' + config.localPort + '...');
	app.listen(config.localPort);
	logger.info('Listening on port ' + config.localPort);
}


var SymbologyToPostgreSqlMigration = require('./migration/SymbologyToPostgreSql');
var PgPool = require('./postgresql/PgPool');
var DatabaseSchema = require('./postgresql/DatabaseSchema');


var pool = new PgPool({
	user: config.pgDataUser,
	database: config.pgDataDatabase,
	password: config.pgDataPassword,
	host: config.pgDataHost,
	port: config.pgDataPort
});
new DatabaseSchema(pool, config.postgreSqlSchema).create().then(function(){
	return new SymbologyToPostgreSqlMigration(pool).run();
}).then(function(){
	logger.info('Finished Migrations.');

	app = express();
	async.series([
			function(callback) {
				conn.init(app,callback);
			},
			function(callback) {
				loc.init(callback);
			}],
		initServer
	);
});