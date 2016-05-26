module.exports = {
	localHost       : "127.0.0.1",
	localPort       : 4000,
	localPath       : "/",

	remoteProtocol  : "http",
	remoteAddress   : "localhost:4000",

	pgDataConnString   : "postgres://postgres:postgres@185.8.164.70:5432/geonode_data",
	pgGeonodeConnString: "postgres://postgres:postgres@185.8.164.70:5432/geonode",
	mongoConnString    : "mongodb://185.8.164.70:27017/panther",

	workspaceSchemaMap: {
		geonode: "public"
	},

	//remoteDbSchemas: {
	//	urbis: {
	//		connString     : "postgres://geonode:TheGeoNodeBigFan@37.205.9.78:5432/urbis",
	//		workspaceSchemaMap: {
	//			urbis_ancillary_layers: "ancillary_layers",
	//			urbis_input: "input",
	//			urbis_results_final: "results_final"
	//		}
	//	}
	//},

	geoserverHost   : "185.8.164.70",
	geoserverPort   : 8080,
	geoserverPath   : "/geoserver",
	geoserverUsername : "admin",
	geoserverPassword : "GeoNodeGeoServerNr1",

	geoserver2Host  : "185.8.164.70",
	geoserver2Port  : 8080,
	geoserver2Path  : "/geoserver_i2",
	geoserver2Username  : "admin",
	geoserver2Password  : "GeoNodeGeoServerNr2",
	geoserver2Workspace : "puma",

	geonodeProtocol : "http",
	geonodeHost     : "185.8.164.70",
	geonodePath     : "",
	geonodeHome     : "/geonode",

	debug: true,

	toggles: {
		noGeoserverLayerGroups: false,
		useWBAgreement: false,
		useWBHeader: false,
		useHeader: false,
		useWBFooter: false,
		useFooterLegal: false,
		allowPumaHelp: false,
		allowDownloadsLink: false,
		usePumaLogo: false,
		advancedFiltersFirst: false
	},

	texts: {
		renameAdvancedFiltersTo: "Evaluation Tool",
		appTitle: "Urbis",
		appName: "&nbsp;"
	},

	allowedOrigins: "http://localhost:5555",
	/*
	 * It decides to which level will be the information logged. Default value is 1 meaning Info and higher will be logged
	 * 0 - TRACE
	 * 1 - INFO
	 * 2 - WARNING
	 * 3 - ERROR
	 * 4 - NOTHING
	 * Set level and all above will be logged.
	 */
	loggingLevel: 0,




	/*
	 * UrbanTEP - Destination of temporary downloaded files.
	 */
	temporaryDownloadedFilesLocation: 'C:\\Users\\jbalhar\\',

	/*
	 * UrbanTEP - UserName and Password under which the layers are uploaded
	 */
	urbanTepGeonodeUserName: '',
	urbanTepGeonodeUserPassword: '',

	/*
	 * UrbanTep - Approximate pixel size in input tif file, m^2
	 */
	urbanTepTifPixelSize: 75*75

};
