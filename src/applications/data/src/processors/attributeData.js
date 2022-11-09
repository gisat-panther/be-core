const _ = require('lodash');

const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const db = require('../../../../db');
const plan = require('../../../plan');
const query = require('../../../../modules/rest/query');


async function getData(group, type, user, filter) {
	let data = await query.list({ group, type, user }, { filter });
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
	let attributeRelations = false;
	let attributeData = false;
	let index = false;

	if (filter.relations.relations) {
		attributeRelations = _.map(_.slice(rawData.attribute, rawData.data.pagination.relations.offset, rawData.data.pagination.relations.offset + rawData.data.pagination.relations.limit), (attributeRelation) => {
			let cleanAttributeRelation = {
				key: attributeRelation.key,
				data: {
					...attributeRelation
				}
			}

			_.unset(cleanAttributeRelation.data, "key");
			_.unset(cleanAttributeRelation.data, "attributeDataSource");

			return cleanAttributeRelation;
		})
	}

	if (filter.data.data) {
		attributeData = rawData.data.attribute;
		index = rawData.data.index;
	}

	let formattedResponse = {
		attributeRelationsDataSources: {
			total: rawData.data.pagination.relations.total,
			offset: rawData.data.pagination.relations.offset,
			limit: rawData.data.pagination.relations.limit,
			attributeRelations
		},
		attributeData: {
			total: rawData.data.pagination.data.total,
			offset: rawData.data.pagination.data.offset,
			limit: rawData.data.pagination.data.limit,
			attributeData,
			index: index
		}
	};

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
		attribute: {},
		pagination: {
			relations: {
				limit: filter.relations.limit || 100,
				offset: filter.relations.offset || 0,
				total: relations.attribute.length
			},
			data: {
				limit: filter.data.limit || 100,
				offset: filter.data.offset || 0,
				total: 0
			}
		},
		index: []
	};

	let geometrySql = "";

	if (filter.data.spatialFilter && _.keys(filter.data.spatialFilter).length) {
		if (filter.data.spatialFilter.tiles) {
			const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.tiles.level);

			const gridAsGeoJson = ptrTileGrid.utils.getTileGridAsGeoJSON([filter.data.spatialFilter.tiles.tiles], gridSize);

			let featureGeometrySql = [];
			_.each(gridAsGeoJson.features, (feature) => {
				featureGeometrySql.push(`ST_GeomFromGeoJSON('${JSON.stringify(feature.geometry)}')`);
			});

			if (featureGeometrySql.length) {
				geometrySql = `ST_Collect(ARRAY[${featureGeometrySql.join(", ")}])`;
			}
		}
	}

	const spatialQueries = [];
	if (geometrySql) {
		_.each(relations.spatial, (spatialRelation) => {
			const spatialDataSource = spatialRelation.spatialDataSource;
			spatialQueries.push(
				db.query(
					`SELECT "${spatialDataSource.fidColumnName}" AS "featureKey" 
					FROM "${spatialDataSource.tableName}" 
					WHERE ST_Intersects("${spatialDataSource.geometryColumnName}", ${geometrySql})`
				)
			);
		});
	}

	let allowedFeatureKeys = null;
	if (spatialQueries.length) {
		allowedFeatureKeys = await Promise
			.all(spatialQueries)
			.then((pgResults) => {
				return _.uniq(
					_.flatten(
						_.map(pgResults, (pgResult) => {
							return _.map(pgResult.rows, 'featureKey');
						})
					)
				)
			});
	}

	if (filter.data.featureKeys && filter.data.featureKeys.length && allowedFeatureKeys) {
		allowedFeatureKeys = _.intersection(allowedFeatureKeys, filter.data.featureKeys);
	} else if (filter.data.featureKeys && filter.data.featureKeys.length) {
		allowedFeatureKeys = filter.data.featureKeys;
	}

	if (allowedFeatureKeys === null || allowedFeatureKeys.length) {
		const relationsGroupedByTableAndFidColumn = _.groupBy(relations.attribute, (attributeRelation) => {
			return `${attributeRelation.attributeDataSource.tableName}_${attributeRelation.attributeDataSource.fidColumnName}`;
		})

		const attributeQueries = [];
		_.each(relationsGroupedByTableAndFidColumn, (relations) => {
			let fidColumnName, tableName;
			let columns = [];

			_.each(relations, (relation) => {
				const attributeDataSource = relation.attributeDataSource;
				if (!fidColumnName) {
					fidColumnName = attributeDataSource.fidColumnName;
				}
				if (!tableName) {
					tableName = attributeDataSource.tableName;
				}

				columns.push(`"${attributeDataSource.columnName}" AS "${attributeDataSource.key}"`);
			});

			let where = "";
			if (allowedFeatureKeys && allowedFeatureKeys.length) {
				allowedFeatureKeys = allowedFeatureKeys.map((allowedFeatureKey) => typeof allowedFeatureKey === "string" ? `'${allowedFeatureKey}'` : allowedFeatureKey);
				where = `WHERE "${fidColumnName}" IN (${allowedFeatureKeys.join(", ")})`;
			}

			attributeQueries.push(
				db.query(
					`SELECT "${fidColumnName}" AS "featureKey", ${columns.join(", ")}, COUNT(*) OVER () AS total 
					FROM "${tableName}" 
					${where} 
					LIMIT ${data.pagination.data.limit} OFFSET ${data.pagination.data.offset}`
				)
			);
		});

		await Promise
			.all(attributeQueries)
			.then((pgResults) => {
				_.each(pgResults, (pgResult) => {
					_.each(pgResult.rows, (row) => {
						const featureKey = row.featureKey;
						const total = Number(row.total);

						if (total > data.pagination.data.total) {
							data.pagination.data.total = total;
						}

						_.unset(row, "featureKey");
						_.unset(row, "total");

						data.index.push(featureKey);

						_.each(row, (value, attributeDataSourceKey) => {
							if (!data.attribute.hasOwnProperty(attributeDataSourceKey)) {
								data.attribute[attributeDataSourceKey] = {};
							}

							data.attribute[attributeDataSourceKey][featureKey] = value;
						})
					})
				});
			});
	}

	return data;
}

async function populateRelationsWithDataSources(relations, user) {
	const spatialDataSourceKeys = _.map(relations.spatial, (spatialRelation) => {
		return spatialRelation.spatialDataSourceKey;
	});

	if (spatialDataSourceKeys.length) {
		const spatialDataSources = await getData("dataSources", "spatial", user, { key: { in: spatialDataSourceKeys } });

		_.each(relations.spatial, (spatialRelation) => {
			_.each(spatialDataSources, (spatialDataSource) => {
				if (spatialRelation.spatialDataSourceKey === spatialDataSource.key) {
					spatialRelation.spatialDataSource = spatialDataSource;
				}
			})
		});
	}

	const attributeDataSourceKeys = _.map(relations.attribute, (attributeRelation) => {
		return attributeRelation.attributeDataSourceKey;
	});

	if (attributeDataSourceKeys.length) {
		const attributeDataSources = await getData("dataSources", "attribute", user, { key: { in: attributeDataSourceKeys } });

		_.each(relations.attribute, (attributeRelation) => {
			_.each(attributeDataSources, (attributeDataSource) => {
				if (attributeRelation.attributeDataSourceKey === attributeDataSource.key) {
					attributeRelation.attributeDataSource = attributeDataSource;
				}
			})
		});
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
		_.set(spatialRelationsFilter, 'spatialDataSourceKey', { in: filter.data.dataSourceKeys });
	}

	if (filter.hasOwnProperty("attributeKeys") && filter.attributeKeys.length) {
		_.set(attributeRelationsFilter, "attributeKey", { in: filter.attributeKeys });
	}

	if (filter.hasOwnProperty('areaTreeLevelKey')) {
		_.set(attributeRelationsFilter, 'areaTreeLevelKey', filter.areaTreeLevelKey);
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