const _ = require('lodash');

const PgCollection = require('../common/PgCollection');
const PgScopeScenarioCaseRelations = require('./PgScopeScenarioCaseRelations');

class PgScenarioCases extends PgCollection {
	constructor(pgPool, pgSchema) {
		super(pgPool, pgSchema, 'PgScenarios');

		this._pgScopeScenarioCaseRelations = new PgScopeScenarioCaseRelations(pgPool, pgSchema);
	}

	createWithouId(object) {
		if (!object) throw new Error('empty input');

		let scopeId;
		if(object.hasOwnProperty('scope_id')) {
			scopeId = object['scope_id'];
			delete object['scope_id'];
		}

		let keys = Object.keys(object);
		let columns = _.map(keys, (key) => {
			return `"${key}"`;
		});
		let values = _.map(keys, (key) => {
			return _.isNumber(object[key]) ? object[key] : `'${object[key]}'`;
		});

		return this._pool.query(`INSERT INTO "${this._schema}"."${PgScenarioCases.tableName()}" (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING *;`)
			.then((queryResult) => {
				if (queryResult.rowCount) {
					return queryResult.rows[0];
				} else {
					throw new Error('insert failed');
				}
			}).then((createdObject) => {
				if(scopeId) {
					return this._pgScopeScenarioCaseRelations.createWithouId({
						scope_id: scopeId,
						scenario_case_id: createdObject.id
					}).then(() => {
						createdObject['scope_id'] = scopeId;
						return createdObject;
					});
				} else {
					return createdObject;
				}
			});
	}

	getFiltered(filter) {
		let keys = filter ? Object.keys(filter) : [];
		let columns = _.map(keys, (key) => {
			return `"${key}"`;
		});
		let values = _.map(keys, (key) => {
			return _.isNumber(filter[key]) ? filter[key] : `'${filter[key]}'`;
		});

		return this._pool.query(`SELECT * FROM "${this._schema}"."${PgScenarioCases.tableName()}";`)
			.then((queryResult) => {
				return queryResult.rows;
			});
	}

	static tableName() {
		return `scenario_case`;
	}
}

module.exports = PgScenarioCases;