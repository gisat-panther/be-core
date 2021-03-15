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
		spatialAttributeRelationsDataSources: {
			total: {
				attributeRelations: rawData.attribute.length,
				spatialRelations: rawData.spatial.length
			},
			offset: (filter.relations && filter.relations.offset) || 0,
			limit: (filter.relations && filter.relations.limit) || 100,
			spatialRelations: [],
			attributeRelations: [],
			spatialDataSources: [],
			attributeDataSources: [],
		},
		spatialData: rawData.data.spatial,
		attributeData: rawData.data.attribute
	}


	if (filter.relations && filter.relations.spatial) {
		rawData.spatial.forEach((spatialRelation) => {
			formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources.push({
				key: spatialRelation.spatialDataSource.key,
				data: {
					..._.pick(spatialRelation.spatialDataSource, _.without(_.keys(spatialRelation.spatialDataSource), 'key'))
				}
			});

			formattedResponse.spatialAttributeRelationsDataSources.spatialRelations.push(spatialRelation);
		})
	}

	if (filter.relations && filter.relations.attribute) {
		rawData.attribute.forEach((attributeRelation) => {
			formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources.push({
				key: attributeRelation.attributeDataSource.key,
				data: {
					..._.pick(attributeRelation.attributeDataSource, _.without(_.keys(attributeRelation.attributeDataSource), 'key'))
				}
			});

			formattedResponse.spatialAttributeRelationsDataSources.attributeRelations.push(attributeRelation);
		})
	}

	formattedResponse.spatialAttributeRelationsDataSources.spatialRelations = _.slice(formattedResponse.spatialAttributeRelationsDataSources.spatialRelations, formattedResponse.spatialAttributeRelationsDataSources.offset, formattedResponse.spatialAttributeRelationsDataSources.offset + formattedResponse.spatialAttributeRelationsDataSources.limit);
	formattedResponse.spatialAttributeRelationsDataSources.attributeRelations = _.slice(formattedResponse.spatialAttributeRelationsDataSources.attributeRelations, formattedResponse.spatialAttributeRelationsDataSources.offset, formattedResponse.spatialAttributeRelationsDataSources.offset + formattedResponse.spatialAttributeRelationsDataSources.limit);

	formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources = _.filter(formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources, (spatialDataSource) => {
		return _.map(formattedResponse.spatialAttributeRelationsDataSources.spatialRelations, 'spatialDataSourceKey').includes(spatialDataSource.key);
	});

	formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources = _.filter(formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources, (attributeDataSource) => {
		return _.map(formattedResponse.spatialAttributeRelationsDataSources.attributeRelations, 'attributeDataSourceKey').includes(attributeDataSource.key);
	});

	formattedResponse.spatialAttributeRelationsDataSources.spatialRelations = _.map(formattedResponse.spatialAttributeRelationsDataSources.spatialRelations, (spatialRelation) => {
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

	formattedResponse.spatialAttributeRelationsDataSources.attributeRelations = _.map(formattedResponse.spatialAttributeRelationsDataSources.attributeRelations, (attributeRelation) => {
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
		spatial: {},
		attribute: {}
	};

	let spatialRelationKeys = _.keys(corePlan.relations.spatial.columns);
	let attributeRelationKeys = _.keys(corePlan.relations.attribute.columns);
	let commonKeys = _.without(_.intersection(spatialRelationKeys, attributeRelationKeys), "key");

	const allowedDataSourceTypes = ["tiledVector"];

	const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;
	const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.level);
	const geometryTolerance = gridSize / tileSize;

	const tileGeometries = {};
	_.each(filter.data.spatialFilter.tiles, (tile) => {
		tileGeometries[`${tile[0]},${tile[1]}`] = ptrTileGrid.utils.getTileAsPolygon(tile, gridSize);
	});
	const spatialIndex = filter.data.spatialIndex || filter.data.spatialFilter;

	let featureKeys = [];
	let requestedFeatureKeys = filter.data.featureKeys;

	for (const spatialRelation of relations.spatial) {
		let spatialDataSource = spatialRelation.spatialDataSource;
		let whereSqls = [];

		if (!allowedDataSourceTypes.includes(spatialDataSource.type)) {
			continue;
		}

		let hasTopo = await db.query(`SELECT count(*) AS "hasTopo" FROM "information_schema"."columns" WHERE "table_name" = '${spatialDataSource.tableName}' AND "column_name" = 'topo';`)
			.then((pgResult) => {
				return !!(pgResult.rows[0].hasTopo);
			});

		let geometryColumnSql;
		if (hasTopo) {
			geometryColumnSql = `ST_AsGeoJSON(topology.st_simplify("topo", ${geometryTolerance})) AS "${spatialDataSource.geometryColumnName}"`;
		} else {
			geometryColumnSql = `ST_AsGeoJSON(ST_Simplify("${spatialDataSource.geometryColumnName}", ${geometryTolerance})) AS "${spatialDataSource.geometryColumnName}"`;
		}

		let featureKeysWhereSql;
		if (requestedFeatureKeys && requestedFeatureKeys.length) {
			let featureKeysString = JSON.stringify(requestedFeatureKeys).replace(/"/g, "'").replace(/(\[)|(\])/g, "");
			whereSqls.push(`"${spatialDataSource.fidColumnName}" IN (${featureKeysString})`);
		}

		whereSqls.push(`ST_Intersects("${spatialDataSource.geometryColumnName}", ST_GeomFromGeoJSON('${JSON.stringify(tileGeometries[spatialIndex.tiles[0]].geometry)}'))`)

		let spatialDataPgQuerySql = `SELECT "${spatialDataSource.fidColumnName}", ${geometryColumnSql} FROM "${spatialDataSource.tableName}" WHERE ${whereSqls.join(" AND ")}`;

		await db.query(spatialDataPgQuerySql)
			.then((pgResult) => {
				data.spatial[spatialDataSource.key] = {
					data: {},
					spatialIndex: {
						[filter.data.spatialFilter.level]: {
							[spatialIndex.tiles[0]]: _.map(pgResult.rows, spatialDataSource.fidColumnName)
						}
					}
				}

				featureKeys = _.concat(featureKeys, _.map(pgResult.rows, spatialDataSource.fidColumnName));

				if (filter.data.geometry) {
					_.each(pgResult.rows, (row) => {
						if (row.hasOwnProperty(spatialDataSource.geometryColumnName)) {
							data.spatial[spatialDataSource.key].data[row[spatialDataSource.fidColumnName]] = JSON.parse(row[spatialDataSource.geometryColumnName]);
						}
					});
				}
			});
	}

	let isAttributeFilterActive = false;
	if (featureKeys.length) {
		for (const attributeRelation of relations.attribute) {
			let attributeDataSource = attributeRelation.attributeDataSource;

			let attributeWhereSqls = [];

			let featureKeysString = JSON.stringify(featureKeys).replace(/"/g, "'").replace(/(\[)|(\])/g, "");

			attributeWhereSqls.push(`"${attributeDataSource.fidColumnName}" IN (${featureKeysString})`)

			if (filter.data.attributeFilter) {
				let attributeKeys = _.keys(filter.data.attributeFilter);
				if (attributeKeys.includes(attributeRelation.attributeKey)) {

					isAttributeFilterActive = true;

					if (_.isObject(filter.data.attributeFilter[attributeRelation.attributeKey])) {
						if (filter.data.attributeFilter[attributeRelation.attributeKey].in) {
							let attributeValuesString = JSON.stringify(filter.data.attributeFilter[attributeRelation.attributeKey].in).replace(/"/g, "'").replace(/(\[)|(\])/g, "");
							attributeWhereSqls.push(`"${attributeDataSource.columnName}" IN (${attributeValuesString})`);
						}
					} else {
						if (_.isNumber(filter.data.attributeFilter[attributeRelation.attributeKey])) {
							attributeWhereSqls.push(`"${attributeDataSource.columnName}" = ${filter.data.attributeFilter[attributeRelation.attributeKey]}`);
						} else {
							attributeWhereSqls.push(`"${attributeDataSource.columnName}" = '${filter.data.attributeFilter[attributeRelation.attributeKey]}'`);
						}
					}
				}
			}

			let attributeDataPgQuerySql = `SELECT "${attributeDataSource.fidColumnName}", "${attributeDataSource.columnName}" FROM "${attributeDataSource.tableName}" WHERE ${attributeWhereSqls.join(" AND ")}`;

			await db.query(attributeDataPgQuerySql)
				.then((pgQuery) => {
					if (pgQuery.rows.length) {
						data.attribute[attributeDataSource.key] = {};
						featureKeys = [];

						_.each(pgQuery.rows, (row) => {
							data.attribute[attributeDataSource.key][row[attributeDataSource.fidColumnName]] = row[attributeDataSource.columnName];
							featureKeys.push(row[attributeDataSource.fidColumnName]);
						})
					}
				})
		}
	}

	if (isAttributeFilterActive) {
		_.each(data.spatial, (spatial, key) => {
			let filteredData = {};
			let filteredSpatialIndex = {};

			_.each(spatial.data, (data, key) => {
				if (featureKeys.includes(key)) {
					filteredData[key] = data;
				}
			})

			_.each(spatial.spatialIndex, (spatialIndex, level) => {
				_.each(spatial.spatialIndex[level], (fids, tile) => {
					if (!filteredSpatialIndex.hasOwnProperty(level)) {
						filteredSpatialIndex[level] = {};
					}

					filteredSpatialIndex[level][tile] = _.intersection(featureKeys, fids);
				})
			});

			data.spatial[key].data = filteredData;
			data.spatial[key].spatialIndex = filteredSpatialIndex;
		})
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
	if (filter.hasOwnProperty('layerTemplateKey')) {
		_.set(spatialRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
	}

	if (filter.data.hasOwnProperty('dataSourceKeys')) {
		_.set(spatialRelationsFilter, 'spatialDataSourceKey', {in: filter.data.dataSourceKeys});
	}

	relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);

	let attributeRelationsFilter = filter.modifiers || {};
	if (filter.hasOwnProperty('styleKey')) {
		if (filter.data.hasOwnProperty('dataSourceKeys')) {
			_.set(attributeRelationsFilter, 'attributeDataSourceKey', {in: filter.data.dataSourceKeys});
		}

		let styles = await getData(`metadata`, `styles`, user, {key: filter.styleKey});
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

		relations.attribute = await getData(`relations`, `attribute`, user, attributeRelationsFilter);
	}

	return relations;
}

async function getFormattedResponse(filter, user) {
	let rawData = await getPopulatedRelationsByFilter(filter, user);
	return formatData(rawData, filter);
}

module.exports = async function (filter, user) {
	return await getFormattedResponse(filter, user);
}