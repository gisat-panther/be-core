const _ = require('lodash');
const SQL = require('sql-template-strings');
const { v4: uuid } = require('uuid');

const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const db = require('../../../../db');
const plan = require('../../../plan');
const query = require('../../../../modules/rest/query');

const supportedSpatialDataTypes = ["tiledVector", "vector"];

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
	let formattedResponse = {
		spatialAttributeRelationsDataSources: {
			total: {
				attributeRelations: rawData.attribute.length,
				spatialRelations: rawData.spatial.length,
				areaRelations: rawData.area.length
			},
			offset: (filter.relations && filter.relations.offset) || 0,
			limit: (filter.relations && filter.relations.limit) || 100,
			spatialRelations: [],
			areaRelations: [],
			attributeRelations: [],
			spatialDataSources: [],
			attributeDataSources: []
		},
		spatialData: rawData.data.spatial,
		attributeData: rawData.data.attribute
	}

	const usedSpatialDataSources = [];

	if (filter.relations && filter.relations.spatial) {
		rawData.spatial.forEach((spatialRelation) => {
			formattedResponse.spatialAttributeRelationsDataSources.spatialRelations.push(spatialRelation);

			if (usedSpatialDataSources.includes(spatialRelation.spatialDataSource.key)) {
				return;
			}

			formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources.push({
				key: spatialRelation.spatialDataSource.key,
				data: {
					..._.pick(spatialRelation.spatialDataSource, _.without(_.keys(spatialRelation.spatialDataSource), 'key'))
				}
			});

			usedSpatialDataSources.push(spatialRelation.spatialDataSource.key);
		})
	}

	if (filter.relations && filter.relations.area) {
		rawData.area.forEach((relation) => {
			formattedResponse.spatialAttributeRelationsDataSources.areaRelations.push(relation);

			if (usedSpatialDataSources.includes(relation.spatialDataSource.key)) {
				return;
			}

			console.log(relation);

			formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources.push({
				key: relation.spatialDataSource.key,
				data: {
					..._.pick(relation.spatialDataSource, _.without(_.keys(relation.spatialDataSource), 'key'))
				}
			});

			usedSpatialDataSources.push(relation.spatialDataSource.key);
		})
	}

	if (filter.relations && filter.relations.attribute) {
		const usedAttributeDataSources = [];

		rawData.attribute.forEach((attributeRelation) => {
			formattedResponse.spatialAttributeRelationsDataSources.attributeRelations.push(attributeRelation);

			if (usedAttributeDataSources.includes(attributeRelation.attributeDataSource.key)) {
				return;
			}

			formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources.push({
				key: attributeRelation.attributeDataSource.key,
				data: {
					..._.pick(attributeRelation.attributeDataSource, _.without(_.keys(attributeRelation.attributeDataSource), 'key'))
				}
			});

			usedAttributeDataSources.push(attributeRelation.attributeDataSource.key);
		})
	}

	formattedResponse.spatialAttributeRelationsDataSources.spatialRelations = _.slice(formattedResponse.spatialAttributeRelationsDataSources.spatialRelations, formattedResponse.spatialAttributeRelationsDataSources.offset, formattedResponse.spatialAttributeRelationsDataSources.offset + formattedResponse.spatialAttributeRelationsDataSources.limit);
	formattedResponse.spatialAttributeRelationsDataSources.attributeRelations = _.slice(formattedResponse.spatialAttributeRelationsDataSources.attributeRelations, formattedResponse.spatialAttributeRelationsDataSources.offset, formattedResponse.spatialAttributeRelationsDataSources.offset + formattedResponse.spatialAttributeRelationsDataSources.limit);

	formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources = _.filter(formattedResponse.spatialAttributeRelationsDataSources.spatialDataSources, (spatialDataSource) => {
		let spatialAreaRelations = _.concat(
			[],
			formattedResponse.spatialAttributeRelationsDataSources.spatialRelations,
			formattedResponse.spatialAttributeRelationsDataSources.areaRelations
		);
		return _.map(spatialAreaRelations, 'spatialDataSourceKey').includes(spatialDataSource.key);
	});

	formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources = _.filter(formattedResponse.spatialAttributeRelationsDataSources.attributeDataSources, (attributeDataSource) => {
		return _.map(formattedResponse.spatialAttributeRelationsDataSources.attributeRelations, 'attributeDataSourceKey').includes(attributeDataSource.key);
	});

	formattedResponse.spatialAttributeRelationsDataSources.spatialRelations = _.map(formattedResponse.spatialAttributeRelationsDataSources.spatialRelations, (relation) => {
		let clearRelation = {
			key: relation.key,
			data: {
				...relation
			}
		};

		delete clearRelation.data.key;
		delete clearRelation.data.data;
		delete clearRelation.data.spatialDataSource;
		delete clearRelation.data.spatialIndex;

		return clearRelation;
	});

	formattedResponse.spatialAttributeRelationsDataSources.areaRelations = _.map(formattedResponse.spatialAttributeRelationsDataSources.areaRelations, (relation) => {
		let clearRelation = {
			key: relation.key,
			data: {
				...relation
			}
		};

		delete clearRelation.data.key;
		delete clearRelation.data.data;
		delete clearRelation.data.spatialDataSource;
		delete clearRelation.data.spatialIndex;

		return clearRelation;
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

const getDataForQueryOptionsAndFilter = async (queryOptions, filter) => {
	const data = {
		spatial: {},
		attribute: {}
	};

	const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;
	const level = filter.data.spatialFilter.level;
	const gridSize = ptrTileGrid.utils.getGridSizeForLevel(level);
	const geometryTolerance = gridSize / tileSize;

	let tile;
	if (filter.data.spatialIndex && filter.data.spatialIndex.tiles && filter.data.spatialIndex.tiles.length) {
		tile = filter.data.spatialIndex.tiles[0]
	} else if (filter.data.spatialFilter && filter.data.spatialFilter.tiles && filter.data.spatialFilter.tiles.length) {
		tile = filter.data.spatialFilter.tiles[0];
	}

	let tileAsPolygon;
	if (tile) {
		tileAsPolygon = ptrTileGrid.utils.getTileAsPolygon(tile, gridSize);
	}

	let featureKeys = [];
	for (const [key, dataSource] of Object.entries({ ...queryOptions.spatial, ...queryOptions.area })) {
		if (tileAsPolygon) {
			const isSimple = await db
				.query(`SELECT EXISTS (SELECT FROM "pg_tables" WHERE "schemaname" = 'public' AND "tablename" = '${dataSource.tableName}_simple');`)
				.then((pgResult) => {
					return pgResult.rows[0].exists;
				});

			let sql;
			if (isSimple) {
				sql =
					`SELECT "base"."${dataSource.fidColumnName}" AS "featureKey", "simple"."json"::JSON AS geometry 
					FROM "${dataSource.tableName}" AS "base"
					LEFT JOIN "${dataSource.tableName}_simple" AS "simple" ON "simple"."${dataSource.fidColumnName}" = "base"."${dataSource.fidColumnName}"`;

				if (dataSource.type === "tiledVector") {
					sql += ` WHERE "simple"."level" = ${level} AND "base"."${dataSource.geometryColumnName}" && ST_GeomFromGeoJSON('${JSON.stringify(tileAsPolygon.geometry)}')`;
				}
			} else {
				sql =
					`SELECT "${dataSource.fidColumnName}" AS "featureKey", "${dataSource.geometryColumnName}"::JSON AS geometry 
					FROM "${dataSource.tableName}"`;

				if (dataSource.type === "tiledVector") {
					sql += ` WHERE "${dataSource.geometryColumnName}" && ST_GeomFromGeoJSON('${JSON.stringify(tileAsPolygon.geometry)}')`;
				}
			}

			await db
				.query(sql)
				.then((pgResult) => {
					featureKeys = _.concat(featureKeys, _.map(pgResult.rows, "featureKey"));
					data.spatial[key] = {
						data: _.zipObject(_.map(pgResult.rows, "featureKey"), _.map(pgResult.rows, "geometry"))
					}

					if (dataSource.type === "tiledVector") {
						data.spatial[key].spatialIndex = {
							[level]: {
								[tile]: _.map(pgResult.rows, 'featureKey')
							}
						}
					}
				})
		} else {
			throw new Error("no tile");
		}
	}
	featureKeys = _.uniq(featureKeys);

	if (featureKeys.length) {
		for (const [property, queryData] of Object.entries(queryOptions.attribute)) {
			let columns = _.map(queryData.dataSources, (dataSource, key) => {
				return `"${dataSource.columnName}" AS "${key}"`
			});

			let params = _.map(featureKeys, (value, index) => {
				return `$${index + 1}`;
			});

			let sql = `SELECT "${queryData.fidColumnName}" AS "featureKey", ${columns.join(", ")} FROM "${queryData.tableName}" WHERE "${queryData.fidColumnName}" IN (${params.join(", ")})`

			await db
				.query(sql, featureKeys)
				.then((pgResult) => {
					_.each(queryData.dataSources, (dataSource, key) => {
						data.attribute[key] = data.attribute[key] || {};
						_.each(pgResult.rows, (row) => {
							data.attribute[key][row.featureKey] = row[key];
						})
					})
				})
		}
	}

	return data;
}

const getQueryOptionsForRelationsAndFilter = (relations, filter) => {
	const queryOptions = {
		area: {},
		spatial: {},
		attribute: {}
	}

	_.each(relations.area, (areaRelation) => {
		const dataSource = areaRelation.spatialDataSource;
		if (supportedSpatialDataTypes.includes(dataSource.type)) {
			if (!queryOptions.area[dataSource.key]) {
				queryOptions.area[dataSource.key] = {
					...dataSource
				}
			}
		}
	});

	_.each(relations.spatial, (spatialRelation) => {
		const dataSource = spatialRelation.spatialDataSource;
		if (supportedSpatialDataTypes.includes(dataSource.type)) {
			if (!queryOptions.spatial[dataSource.key]) {
				queryOptions.spatial[dataSource.key] = {
					...dataSource
				}
			}
		}
	});

	_.each(relations.attribute, (attributeRelation) => {
		const dataSource = attributeRelation.attributeDataSource;
		const property = `${dataSource.tableName}_${dataSource.fidColumnName}`;
		if (!queryOptions.attribute[property] && dataSource.tableName && dataSource.fidColumnName) {
			queryOptions.attribute[property] = {
				tableName: dataSource.tableName,
				fidColumnName: dataSource.fidColumnName,
				dataSources: {}
			};
		}

		if (!queryOptions.attribute[property].dataSources[dataSource.key] && dataSource.tableName && dataSource.fidColumnName) {
			queryOptions.attribute[property].dataSources[dataSource.key] = {
				...dataSource
			}
		}
	});

	return queryOptions;
}

const getDataForRelations = async (relations, filter) => {
	const queryOptions = getQueryOptionsForRelationsAndFilter(relations, filter);
	return getDataForQueryOptionsAndFilter(queryOptions, filter);
}

async function populateRelationsWithDataSources(relations, user) {
	let spatialAndAreaRealations = _.concat([], relations.spatial, relations.area);
	let spatialDataSourceKeys = _.map(spatialAndAreaRealations, (relation) => {
		return relation.spatialDataSourceKey
	});
	if (spatialDataSourceKeys.length) {
		let spatialDataSources = await getData(`dataSources`, `spatial`, user, { key: { in: spatialDataSourceKeys } });
		_.each(spatialDataSources, (dataSource) => {
			_.each(spatialAndAreaRealations, (relation) => {
				if (relation.spatialDataSourceKey === dataSource.key) {
					relation.spatialDataSource = dataSource;
				}
			})
		})
	}

	let attributeDataSourceKeys = _.map(relations.attribute, (relation) => {
		return relation.attributeDataSourceKey
	});
	if (attributeDataSourceKeys.length) {
		let attributeDataSources = await getData(`dataSources`, `attribute`, user, {
			key: {
				in: _.map(relations.attribute, (relation) => {
					return relation.attributeDataSourceKey
				})
			}
		});

		_.each(attributeDataSources, (dataSource) => {
			_.each(relations.attribute, (relation) => {
				if (relation.attributeDataSourceKey === dataSource.key) {
					relation.attributeDataSource = dataSource;
				}
			})
		})
	}
}

async function getRelationsByFilter(filter, user) {
	let relations = {
		attribute: [],
		spatial: [],
		area: []
	};

	if (filter.hasOwnProperty('areaTreeKey') || filter.hasOwnProperty('areaTreeLevelKey')) {
		let areaRelationsFilter = filter.modifiers || {};

		if (filter.hasOwnProperty('areaTreeKey')) {
			_.set(areaRelationsFilter, 'areaTreeKey', filter.areaTreeKey);
		}

		if (filter.hasOwnProperty('areaTreeLevelKey')) {
			_.set(areaRelationsFilter, 'areaTreeLevelKey', filter.areaTreeLevelKey);
		}

		if (filter.data.hasOwnProperty('dataSourceKeys')) {
			_.set(areaRelationsFilter, 'spatialDataSourceKey', { in: filter.data.dataSourceKeys });
		}

		relations.area = await getData(`relations`, 'area', user, areaRelationsFilter);

	} else {
		let spatialRelationsFilter = filter.modifiers || {};
		if (filter.hasOwnProperty('layerTemplateKey')) {
			_.set(spatialRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
		}

		if (filter.data.hasOwnProperty('dataSourceKeys')) {
			_.set(spatialRelationsFilter, 'spatialDataSourceKey', { in: filter.data.dataSourceKeys });
		}

		relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);
	}

	let attributeRelationsFilter = filter.modifiers || {};
	if (filter.hasOwnProperty('styleKey')) {
		if (filter.data.hasOwnProperty('dataSourceKeys')) {
			_.set(attributeRelationsFilter, 'attributeDataSourceKey', { in: filter.data.dataSourceKeys });
		}

		if (filter.hasOwnProperty('areaTreeLevelKey')) {
			_.set(attributeRelationsFilter, 'areaTreeLevelKey', filter.areaTreeLevelKey);
		}

		let styles = await getData(`metadata`, `styles`, user, { key: filter.styleKey });
		let style = styles && styles.length && styles[0];

		if (style) {
			let attributeKeys = _.compact(_.flatten(_.map(style.definition.rules, (rule) => {
				return _.map(rule.styles, (style) => {
					return style.attributeKey;
				})
			})));

			if (attributeKeys && attributeKeys.length) {
				_.set(attributeRelationsFilter, 'attributeKey', { in: attributeKeys });
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