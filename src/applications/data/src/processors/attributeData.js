const _ = require('lodash');

const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const db = require('../../../../db');
const plan = require('../../../plan');
const query = require('../../../../modules/rest/query');
const corePlan = require('../../../../applications/core/plan');


async function getData(group, type, user, filter) {
	let data = await query.list({group, type, user}, {filter});
	let compiledPlan = plan.get();

	data = _.map(data.rows, (resource) => {
		if (!compiledPlan[group][type].hasOwnProperty("type")) {
			return _.pick(resource, _.keys(compiledPlan[group][type].columns));
		} else {
			return _.pick(resource, _.concat(_.keys(compiledPlan[group][type].columns), _.keys(compiledPlan[group][type].type.types[resource.type].columns)));
		}
	});

	return data || [];
}

function formatData(rawData, filter) {
	let formattedResponse = {
		data: {
			spatialRelations: [],
			attributeRelations: [],
			spatialDataSources: [],
			attributeDataSources: [],
			spatialData: rawData.data.spatial,
			attributeData: rawData.data.attribute
		},
		total: {
			spatialRelations: rawData.spatial.length,
			attributeRelations: rawData.attribute.length
		},
		limit: (filter.relations && filter.relations.limit) || 100,
		offset: (filter.relations && filter.relations.offset) || 0
	};

	if (filter.data.relations) {
		rawData.spatial.forEach((spatialRelation) => {
			formattedResponse.data.spatialDataSources.push({
				key: spatialRelation.spatialDataSource.key,
				data: {
					..._.pick(spatialRelation.spatialDataSource, _.without(_.keys(spatialRelation.spatialDataSource), 'key'))
				}
			});

			formattedResponse.data.spatialRelations.push(spatialRelation);
		})

		rawData.attribute.forEach((attributeRelation) => {
			formattedResponse.data.attributeDataSources.push({
				key: attributeRelation.attributeDataSource.key,
				data: {
					..._.pick(attributeRelation.attributeDataSource, _.without(_.keys(attributeRelation.attributeDataSource), 'key'))
				}
			});

			formattedResponse.data.attributeRelations.push(attributeRelation);
		})
	}

	formattedResponse.data.spatialRelations = _.slice(formattedResponse.data.spatialRelations, formattedResponse.offset, formattedResponse.offset + formattedResponse.limit);
	formattedResponse.data.attributeRelations = _.slice(formattedResponse.data.attributeRelations, formattedResponse.offset, formattedResponse.offset + formattedResponse.limit);

	formattedResponse.data.spatialDataSources = _.filter(formattedResponse.data.spatialDataSources, (spatialDataSource) => {
		return _.map(formattedResponse.data.spatialRelations, 'spatialDataSourceKey').includes(spatialDataSource.key);
	});

	formattedResponse.data.attributeDataSources = _.filter(formattedResponse.data.attributeDataSources, (attributeDataSource) => {
		return _.map(formattedResponse.data.attributeRelations, 'attributeDataSourceKey').includes(attributeDataSource.key);
	});

	formattedResponse.data.spatialRelations = _.map(formattedResponse.data.spatialRelations, (spatialRelation) => {
		let clearSpatialRelation = {
			key: spatialRelation.key,
			data: {
				...spatialRelation
			}
		};

		delete clearSpatialRelation.data.key;
		delete clearSpatialRelation.data.data;
		delete clearSpatialRelation.data.spatialDataSource;
		delete clearSpatialRelation.data.spatialIndex;

		return clearSpatialRelation;
	});

	formattedResponse.data.attributeRelations = _.map(formattedResponse.data.attributeRelations, (attributeRelation) => {
		let clearAttributeRelation = {
			key: attributeRelation.key,
			data: {
				...attributeRelation
			}
		}

		delete clearAttributeRelation.data.key;
		delete clearAttributeRelation.data.data;
		delete clearAttributeRelation.data.attributeDataSource;

		return clearAttributeRelation;
	});

	return formattedResponse;
}

async function getPopulatedRelationsByFilter(filter, user) {
	let relations = await getRelationsByFilter(filter, user);

	await populateRelationsWithDataSources(relations, user);

	relations.data = await getDataForRelations(relations, filter);

	return relations;
}

async function getDataForRelations(relations, filter) {
	const data = {
		attribute: {}
	};

	for (const attributeRelation of relations.attribute) {
		const attributeDataSource = attributeRelation.attributeDataSource;

		let orderSql = [];

		if (filter.data.attributeOrder && filter.data.attributeOrder.length) {
			_.each(filter.data.attributeOrder, (attributeOrder) => {
				if (attributeOrder[0] === attributeRelation.attributeKey) {
					if (attributeOrder[1] === "ascending") {
						orderSql.push(`"${attributeDataSource.columnName}" ASC`);
					} else {
						orderSql.push(`"${attributeDataSource.columnName}" DESC`);
					}
				}
			})
		}

		if (orderSql.length) {
			orderSql = `ORDER BY ${orderSql.join(", ")}`;
		}

		data.attribute[attributeDataSource.key] = await db.query(`SELECT "${attributeDataSource.fidColumnName}", "${attributeDataSource.columnName}" FROM "${attributeDataSource.tableName}" ${orderSql} ;`)
			.then((pgResult) => {
				return _.map(pgResult.rows, (row) => {
					return {
						[row[attributeDataSource.fidColumnName]]: row[attributeDataSource.columnName]
					}
				})
			});
	}

	return data;
}

async function populateRelationsWithDataSources(relations, user) {
	for (const relation of relations.spatial) {
		let spatialDataSource = await getData(`dataSources`, `spatial`, user, {key: relation.spatialDataSourceKey});
		relation.spatialDataSource = spatialDataSource[0];
	}

	for (const relation of relations.attribute) {
		let attributeDataSource = await getData(`dataSources`, `attribute`, user, {key: relation.attributeDataSourceKey});
		relation.attributeDataSource = attributeDataSource[0];
	}
}

async function getRelationsByFilter(filter, user) {
	let relations = {
		attribute: [],
		spatial: []
	};

	let spatialRelationsFilter = filter.modifiers || {};
	let attributeRelationsFilter = filter.modifiers || {};

	if (filter.hasOwnProperty('layerTemplateKey')) {
		_.set(spatialRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
		_.set(attributeRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
	}

	if (filter.data.hasOwnProperty('dataSourceKeys') && filter.data.dataSourceKeys.length) {
		_.set(spatialRelationsFilter, 'spatialDataSourceKey', {in: filter.data.dataSourceKeys});
	}

	if (filter.hasOwnProperty("attributeKeys") && filter.attributeKeys.length) {
		_.set(attributeRelationsFilter, "attributeKey", {in: filter.attributeKeys});
	}

	relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);
	relations.attribute = await getData(`relations`, 'attribute', user, attributeRelationsFilter);

	return relations;
}

async function getFormattedResponse(filter, user) {
	let rawData = await getPopulatedRelationsByFilter(filter, user);
	return formatData(rawData, filter);
}

module.exports = async function (filter, user) {
	return await getFormattedResponse(filter, user);
}