const ptr4 = {
	url: 'http://localhost/backend', // url on which server is accessible
	urlMapServer: "http://localhost/mapserver", // url on which MapServer is accessible
	masterPort: 9849,
	clusterPorts: [9850, 9851],
	keepAliveWorkers: true,
	pgConfig: {
		normal: {
			user: `panther`,
			password: `panther`,
			database: `panther`,
			host: `localhost`
		},
		superuser: {
			user: `postgres`,
			password: `postgres`,
			database: `postgres`,
			host: `localhost`
		}
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
	}
};

module.exports = ptr4;
