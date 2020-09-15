const _ = require('lodash');

const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const db = require('../../../../db');
const plan = require('../../../plan');
const query = require('../../../../modules/rest/query');

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
			spatialData: {},
			attributeData: {}
		},
		total: {
			spatialRelations: rawData.spatial.length,
			attributeRelations: rawData.attribute.length
		},
		limit: filter.relations.limit,
		offset: filter.relations.offset
	};

	rawData.spatial.forEach((spatialRelation) => {
		if (filter.data.geometry) {
			formattedResponse.data.spatialData[spatialRelation.spatialDataSourceKey] =
				{
					data: spatialRelation.data,
					spatialIndex: spatialRelation.spatialIndex
				};
		}

		formattedResponse.data.spatialDataSources.push({
			key: spatialRelation.spatialDataSource.key,
			data: {
				..._.pick(spatialRelation.spatialDataSource, _.without(_.keys(spatialRelation.spatialDataSource), 'key'))
			}
		});

		formattedResponse.data.spatialRelations.push(spatialRelation);
	})

	rawData.attribute.forEach((attributeRelation) => {
		formattedResponse.data.attributeData[attributeRelation.attributeDataSourceKey] = {};

		formattedResponse.data.attributeData[attributeRelation.attributeDataSourceKey] = attributeRelation.data;

		formattedResponse.data.attributeDataSources.push({
			key: attributeRelation.attributeDataSource.key,
			data: {
				..._.pick(attributeRelation.attributeDataSource, _.without(_.keys(attributeRelation.attributeDataSource), 'key'))
			}
		});

		formattedResponse.data.attributeRelations.push(attributeRelation);
	})

	formattedResponse.data.spatialRelations = _.slice(formattedResponse.data.spatialRelations, filter.relations.offset, filter.relations.offset + filter.relations.limit);
	formattedResponse.data.attributeRelations = _.slice(formattedResponse.data.attributeRelations, filter.relations.offset, filter.relations.offset + filter.relations.limit);

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
		delete clearSpatialRelation.data.spatialDataSourceKey;
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
		delete clearAttributeRelation.data.attributeDataSourceKey;

		return clearAttributeRelation;
	});

	return formattedResponse;
}

async function getPopulatedRelationsByFilter(filter, user) {
	let relations = await getRelationsByFilter(filter, user);

	await populateRelationsWithDataSources(relations, user);

	await populateRelationsWithSpatialIndex(relations, filter);

	await populateRelationsWithData(relations, filter);

	return relations;
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

async function populateRelationsWithData(relations, filter) {
	for(const spatialRelation of relations.spatial) {
		let featureKeys = _.flatten(_.map(spatialRelation.spatialIndex, (featureKeys, spatialIndex) => {
			return featureKeys;
		}));
		let spatialDataQuery = await db.query(
			`SELECT "${spatialRelation.spatialDataSource.fidColumnName}", st_asgeojson("${spatialRelation.spatialDataSource.geometryColumnName}") AS geometry FROM "${spatialRelation.spatialDataSource.tableName}" WHERE "${spatialRelation.spatialDataSource.fidColumnName}" IN ('${featureKeys.join('\', \'')}')`
		);

		spatialRelation.data = {};
		for(const row of spatialDataQuery.rows) {
			spatialRelation.data[row[spatialRelation.spatialDataSource.fidColumnName]] = JSON.parse(row.geometry);
		}

		let relatedAttributeRelations = _.filter(relations.attribute, (attributeRelation) => {
			return attributeRelation.layerTemplateKey = spatialRelation.layerTemplateKey;
		});

		for(const attributeRelation of relatedAttributeRelations) {
			let attributeDataQuery = await db.query(
				`SELECT "${attributeRelation.attributeDataSource.fidColumnName}", "${attributeRelation.attributeDataSource.columnName}" FROM "${attributeRelation.attributeDataSource.tableName}" WHERE "${attributeRelation.attributeDataSource.fidColumnName}" IN ('${featureKeys.join('\', \'')}')`
			);

			attributeRelation.data = {};
			for(const row of attributeDataQuery.rows) {
				attributeRelation.data[row[attributeRelation.attributeDataSource.fidColumnName]] = row[attributeRelation.attributeDataSource.columnName];
			}
		}
	}
}

async function populateRelationsWithSpatialIndex(relations, filter) {
	let gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.level);

	let tileGeometries = {};
	_.each(filter.data.spatialFilter.tiles, (tile) => {
		tileGeometries[`${tile[0]},${tile[1]}`] = ptrTileGrid.utils.getTileAsPolygon(tile, gridSize);
	});

	for (const relation of relations.spatial) {
		let spatialIndex = {};
		for(const key of _.keys(tileGeometries)) {
			let geometry = tileGeometries[key].geometry;
			let queryResult = await db.query(
				`SELECT "${relation.spatialDataSource.fidColumnName}" FROM "${relation.spatialDataSource.tableName}" WHERE st_intersects("${relation.spatialDataSource.geometryColumnName}", st_geomfromgeojson('${JSON.stringify(geometry)}'))`
			)
			spatialIndex[key] = _.map(queryResult.rows, (row) => {
				return row[relation.spatialDataSource.fidColumnName];
			})
		}

		//todo here should be logic which chose how many tiles has to be returned based on feature count (or something like that)
		if(filter.data.spatialIndex) {
			relation.spatialIndex = _.pick(spatialIndex, [`${filter.data.spatialIndex.tiles[0][0]},${filter.data.spatialIndex.tiles[0][1]}`]);
		} else {
			relation.spatialIndex = _.pick(spatialIndex, [`${filter.data.spatialFilter.tiles[0][0]},${filter.data.spatialFilter.tiles[0][1]}`]);
		}
	}
}

async function getRelationsByFilter(filter, user) {
	let relations = {
		attribute: [],
		spatial: []
	};

	let spatialRelationsFilter = filter.modifiers;
	if (filter.hasOwnProperty('layerTemplateKey')) {
		_.set(spatialRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
	}

	relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);

	if (filter.hasOwnProperty("attributeFilter")) {
		filter.relationsFilter = _.merge(filter.relationsFilter, filter.attributeFilter);
	}

	let attributeRelationsFilter = filter.modifiers;
	if (filter.hasOwnProperty('styleKey')) {
		let styles = await getData(`metadata`, `style`, user, {key: filter.styleKey});
		let style = styles[0];

		if (style) {
			let attributeKeys = _.compact(_.flatten(_.map(style.definition.rules, (rule) => {
				return _.map(rule.styles, (style) => {
					return style.attributeKey;
				})
			})));

			if (attributeKeys && attributeKeys.length) {
				_.set(attributeRelationsFilter, 'attributeKey', {in: attributeKeys});
			}
		}
	}
	relations.attribute = await getData(`relations`, `attribute`, user, attributeRelationsFilter);

	return relations;
}

async function getFormattedResponse(filter, user) {
	let rawData = await getPopulatedRelationsByFilter(filter, user);
	return formatData(rawData, filter);
}

module.exports = async function (filter, user) {
	return await getFormattedResponse(filter, user);
}