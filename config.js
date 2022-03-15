const ptr4 = {
	url: 'http://localhost/backend', // url on which server is accessible
	urlMapServer: "http://localhost/mapserver", // url on which MapServer is accessible
	masterPort: 9850,
	isBehindKong: false, // allow auto login based on X-User-Info header which is provided by KongHQ, potential security risk if used without KongHQ
	mapserver: {
		url: "http://localhost:8050", // url on which MapServer is accessible
		mapsPath: "/etc/mapserver/maps",
		storagePath: "/etc/mapserver/storage"
	},
	mapproxy: {
		url: "http://localhost:8051"
	},
	pgConfig: {
		normal: {
			user: `panther`,
			password: `panther`,
			database: `panther`,
			host: `localhost`,
			// keep connections open for 1 hour (instead of default 10 seconds)
			// to make better use of query plan cache (which is per connection)
			idleTimeoutMillis: 3600000,
			allowExitOnIdle: true
		},
		superuser: {
			user: `postgres`,
			password: `postgres`,
			database: `postgres`,
			host: `localhost`
		}
	},
	redisConfig: {
		host: 'localhost'
	},
	pgSchema: {
		analysis: `analysis`,
		data: `data`,
		metadata: `metadata`,
		permissions: `permissions`,
		views: `views`,
		relations: `relations`,
		dataSources: `dataSources`,
		specific: `specific`,
		application: `application`,
		various: `various`,
		user: `user`
	},
	jwt: {
		secret: 'changeMe',
		expiresIn: 604800, // seconds (604800 = 7 days)
	},
	password: {
		iteration_counts: 4
	},
	sso: {
		// https://github.com/jaredhanson/passport-google-oauth2#create-an-application
		google: {
			clientId: null,
			clientSecret: null,
		},
		// https://github.com/jaredhanson/passport-facebook#create-an-application
		facebook: {
			clientId: null,
			clientSecret: null,
		}
	},
	import: {
		raster: {
			paths: {
				mapfile: `/tmp/panther/msmaps`,
				static: `/tmp/panther/static`
			}
		}
	},
	// Directory containing apps. App is a directory with `index.js` file same as the directories in
    // `src/applicatons`. index.js is loaded automatically. Can be `null`.
    externalApplications: __dirname + '/panther-apps',
};

module.exports = ptr4;
