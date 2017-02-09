let Promise = require('promise');
let logger = require('../common/Logger').applicationWideLogger;

var _ = require('underscore');

let FilteredBaseLayers = require('./FilteredBaseLayers');
let PgAnalyticalUnits = require('./PgAnalyticalUnits');

/**
 *
 */
class AnalyticalUnitsController {
	constructor(app, pgPool, mongoDb) {
		this._pool = pgPool;
		this._mongo = mongoDb;

		app.get('/rest/au', this.read.bind(this));
	}

	/**
	 *
	 * @param request
	 * @param response
	 */
	read(request, response) {
		var loc = JSON.parse(request.query.locations);
		let locations = loc && loc.length && loc.map(location => Number(location));
		new FilteredBaseLayers({
			location: {$in: locations},
			areaTemplate: request.query.areaTemplate && Number(request.query.areaTemplate),
			isData: false
		}, this._mongo)
			.read().then(baseLayers => {
			return Promise.all(baseLayers.map(baseLayer => {
				return new PgAnalyticalUnits(this._pool).all(baseLayer._id);
			}));
		}).then(results => {
			let all = [];
			let deduplicated = [];
			results.forEach(units => {
				if(units.length) {
					all = all.concat(units);
					deduplicated = _.uniq(all, 'gid');
				}
			});
			response.json({data: deduplicated});
		}).catch(error => {
			logger.error('AnalyticalUnitsController#read Error: ', error);
			response.status(500).json({status: 'Err'});
		});
	}
}

module.exports = AnalyticalUnitsController;