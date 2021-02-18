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
		attributeRelationsDataSources: {
			total: rawData.data.pagination.relations.total,
			offset: rawData.data.pagination.relations.offset,
			limit: rawData.data.pagination.relations.limit,
			attributeRelations: _.map(_.slice(rawData.attribute, rawData.data.pagination.relations.offset, rawData.data.pagination.relations.offset + rawData.data.pagination.relations.limit), (attributeRelation) => {
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
		},
		attributeData: {
			total: rawData.data.pagination.data.total,
			offset: rawData.data.pagination.data.offset,
			limit: rawData.data.pagination.data.limit,
			attributeData: rawData.data.attribute
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
				total: null
			}
		}
	};

	let geometrySql = "";
	let querySql = "";
	let filteredFeatureKeys = [];

	if (filter.data.spatialFilter && _.keys(filter.data.spatialFilter).length) {
		if (filter.data.spatialFilter.tiles) {
			const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;
			const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.tiles.level);

			const gridAsGeoJson = ptrTileGrid.utils.getTileGridAsGeoJSON([filter.data.spatialFilter.tiles.tiles], gridSize);

			let featureGeometrySql = [];
			_.each(gridAsGeoJson.features, (feature) => {
				featureGeometrySql.push(`ST_GeomFromGeoJSON('${JSON.stringify(feature.geometry)}')`);
			});

			if (featureGeometrySql.length) {
				geometrySql = `ST_Collect(ARRAY[${featureGeometrySql.join(", ")}])`;
			}
		} else if (filter.data.spatialFilter.geoJson) {

		}
	}

	if (relations.attribute.length) {
		let firstAttributeRelation = relations.attribute[0];
		if (firstAttributeRelation) {
			let fidColumnSql = [];
			let columnSql = [];

			_.each(relations.attribute, (attributeRelation) => {
				const attributeDataSource = attributeRelation.attributeDataSource;

				fidColumnSql.push(`"${attributeRelation.key}"."${attributeDataSource.fidColumnName}"`);
				columnSql.push(`"${attributeRelation.key}"."${attributeDataSource.columnName}" AS "${attributeDataSource.key}"`);
			})

			if (fidColumnSql.length && columnSql.length) {
				querySql += `SELECT COALESCE(${fidColumnSql.join(", ")}) AS "featureKey", ${columnSql.join(", ")}, COUNT(*) OVER () AS total`;
				querySql += ` FROM "${firstAttributeRelation.attributeDataSource.tableName}" AS "${firstAttributeRelation.key}"`
			}

			if (relations.attribute.length > 1) {
				_.each(_.slice(relations.attribute, 1), (attributeRelation) => {
					const attributeDataSource = attributeRelation.attributeDataSource;
					querySql += ` FULL JOIN "${attributeDataSource.tableName}" AS "${attributeRelation.key}" ON "${attributeRelation.key}"."${attributeRelation.attributeDataSource.fidColumnName}" = "${firstAttributeRelation.key}"."${firstAttributeRelation.attributeDataSource.fidColumnName}"`
				})
			}

			let whereSql = [];

			if (filter.data.attributeFilter && _.keys(filter.data.attributeFilter).length) {
				_.each(filter.data.attributeFilter, (filter, attributeKey) => {
					let attributeRelation = _.find(relations.attribute, (attributeRelation) => {
						return attributeRelation.attributeKey === attributeKey;
					})

					if (attributeRelation) {
						if (_.isString(filter)) {
							whereSql.push(`"${attributeRelation.key}"."${attributeRelation.attributeDataSource.columnName}" = '${filter}'`);
						} else if (_.isNumber(filter)) {
							whereSql.push(`"${attributeRelation.key}"."${attributeRelation.attributeDataSource.columnName}" = ${filter}`);
						} else if (_.isObject(filter)) {

						}
					}
				});
			}

			if (geometrySql) {
				let spatialQuerySql = [];

				_.each(relations.spatial, (spatialRelation) => {
					const spatialDataSource = spatialRelation.spatialDataSource;

					spatialQuerySql.push(`SELECT "${spatialDataSource.fidColumnName}" AS "featureKey" FROM "${spatialDataSource.tableName}" WHERE ST_Intersects(${geometrySql}, "${spatialDataSource.geometryColumnName}")`);
				})

				if (spatialQuerySql.length) {
					whereSql.push(`COALESCE(${fidColumnSql.join(", ")}) IN (${spatialQuerySql.join(" UNION ")})`);
				}
			}

			if (filter.data.featureKeys && filter.data.featureKeys.length) {
				whereSql.push(`COALESCE(${fidColumnSql.join(", ")}) IN (${_.map(filter.data.featureKeys, (featureKey) => {
					if (_.isNumber(featureKey)) {
						return featureKey;
					} else {
						return `'${featureKey}'`;
					}
				}).join(", ")})`);
			}

			if (whereSql.length) {
				querySql += ` WHERE ${whereSql.join(" AND ")}`
			}

			if (filter.data.attributeOrder && filter.data.attributeOrder.length) {
				let orderSql = [];

				_.each(filter.data.attributeOrder, (attributeOrder) => {
					let attributeRelation = _.find(relations.attribute, (attributeRelation) => {
						return attributeRelation.attributeKey === attributeOrder[0];
					})

					if (attributeRelation) {
						orderSql.push(`"${attributeRelation.attributeDataSource.key}" ${attributeOrder[1] === "ascending" ? "ASC" : "DESC"}`);
					}
				});

				if (orderSql.length) {
					querySql += ` ORDER BY ${orderSql.join(", ")}, "featureKey" ASC`
				}
			} else {
				querySql += ` ORDER BY "featureKey" ASC`
			}
		}
	}

	if (querySql) {
		querySql += ` LIMIT ${data.pagination.data.limit} OFFSET ${data.pagination.data.offset}`

		await db.query(querySql)
			.then((pgResult) => {
				_.each(pgResult.rows, (row) => {
					const featureKey = row.featureKey;

					if (!data.pagination.data.total) {
						data.pagination.data.total = _.toNumber(row.total);
					}

					_.unset(row, "featureKey");
					_.unset(row, "total");

					_.each(row, (value, dataSourceKey) => {
						if (!data.attribute.hasOwnProperty(dataSourceKey)) {
							data.attribute[dataSourceKey] = {};
						}

						data.attribute[dataSourceKey][featureKey] = value;
					})
				});
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