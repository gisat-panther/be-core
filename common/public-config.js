var config = require('../config');

module.exports = function(request, response, next){
	var Config = {
		url: config.remoteProtocol + '://' + config.remoteAddress,
		signupAddress: config.geonodeProtocol + '://' + config.geonodeHost + (config.geonodePort==80 ? "" : ":" + config.geonodePort) + config.geonodePath + '/account/signup/',
		geoserver2Workspace: config.geoserver2Workspace,
		initialBaseMap: config.initialBaseMap,
		initialMapBounds: config.initialMapBounds,
		toggles: config.toggles,
		googleAnalyticsTracker: config.googleAnalyticsTracker,
		googleAnalyticsCookieDomain: config.googleAnalyticsCookieDomain,
		environment: config.environment
	};
	response.end('var Config = ' + JSON.stringify(Config));

};

