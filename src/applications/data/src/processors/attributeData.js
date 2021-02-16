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

	let geometrySql = "";
	let filteredFeatureKeys = [];

	if (filter.data.spatialFilter.tiles) {
		const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;
		const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.tiles.level);

		// todo what is for last parameter and why it throws an error if not set or set to false?
		// there is also problem when set to true, all returned geometry coordinates are set to null
		const gridAsGeoJson = ptrTileGrid.utils.getTileGridAsGeoJSON(filter.data.spatialFilter.tiles.tiles, gridSize);

		let featureGeometrySql = [];
		_.each(gridAsGeoJson.features, (feature) => {
			featureGeometrySql.push(`ST_GeomFromGeoJSON('${JSON.stringify(feature.geometry)}')`);
		});

		geometrySql = `ST_Collect(ARRAY[${featureGeometrySql.join(", ")}])`;

	} else if (filter.data.spatialFilter.geoJson) {

	}

	let querySql = "";

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
				querySql += `SELECT COALESCE(${fidColumnSql.join(", ")}) AS "featureKey", ${columnSql.join(", ")}`;
				querySql += ` FROM "${firstAttributeRelation.attributeDataSource.tableName}" AS "${firstAttributeRelation.key}"`
			}

			if (relations.attribute.length > 1) {
				_.each(_.slice(relations.attribute, 1), (attributeRelation) => {
					const attributeDataSource = attributeRelation.attributeDataSource;
					querySql += ` FULL JOIN "${attributeDataSource.tableName}" AS "${attributeRelation.key}" ON "${attributeRelation.key}"."${attributeRelation.attributeDataSource.fidColumnName}" = "${firstAttributeRelation.key}"."${firstAttributeRelation.attributeDataSource.fidColumnName}"`
				})
			}

			if (filter.data.attributeFilter && _.keys(filter.data.attributeFilter).length) {

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
					querySql += ` ORDER BY ${orderSql.join(", ")}`
				}
			} else {
				querySql += ` ORDER BY "featureKey"`
			}

			querySql += ` LIMIT 1`
		}
	}

	await db.query(querySql)
		.then((pgResult) => {
			console.log(pgResult.rows);
		})
		.catch((error) => {
			console.log(error);
		})

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