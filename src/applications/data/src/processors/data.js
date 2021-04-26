const _ = require('lodash');
const SQL = require('sql-template-strings');
const {v4: uuid} = require('uuid');

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

const getSqlForRelationsAndFilter = (relations, filter) => {
	let sql = SQL``;

	const tileSize = ptrTileGrid.constants.PIXEL_TILE_SIZE;
	const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.level);
	const geometryTolerance = gridSize / tileSize;

	sql.append(`SELECT`);
	sql.append(` "bFid" AS "fid", "geometry", "spatialDataSourceKey", "tile", "level"`);

	_.each(relations.attribute, (attributeRelation) => {
		let attributeDataSource = attributeRelation.attributeDataSource;
		sql.append(`, '${attributeDataSource.key}' AS "attributeDataSourceKey"`);
		sql.append(`, "${attributeDataSource.key}"."${attributeDataSource.columnName}" AS "value"`);
		sql.append(`, "${attributeDataSource.key}"."${attributeDataSource.fidColumnName}" AS "fid2"`)
	});

	sql.append(` FROM (`);

	_.each(relations.spatial, (spatialRelation, index) => {
		let spatialDataSource = spatialRelation.spatialDataSource;

		// todo find better solution for supported types
		if (spatialDataSource.type !== "tiledVector") {
			return;
		}

		if (index > 0) {
			sql.append(` UNION `);
		}

		let tile;
		if (filter.data.spatialIndex && filter.data.spatialIndex.tiles && filter.data.spatialIndex.tiles.length) {
			tile = filter.data.spatialIndex.tiles[0]
		} else if (filter.data.spatialFilter && filter.data.spatialFilter.tiles && filter.data.spatialFilter.tiles.length) {
			tile = filter.data.spatialFilter.tiles[0];
		}

		if (tile) {
			let tileAsPolygon = ptrTileGrid.utils.getTileAsPolygon(tile, gridSize);

			sql.append(`SELECT`)
			sql.append(` "base"."${spatialDataSource.fidColumnName}" AS "bFid"`)
			sql.append(`, "simple"."json" AS "geometry"`)
			sql.append(`, '${spatialDataSource.key}' AS "spatialDataSourceKey"`)
			sql.append(`, '${tile}' AS "tile"`)
			sql.append(`, '${filter.data.spatialFilter.level}' AS "level"`)
			sql.append(` FROM "${spatialDataSource.tableName}" AS base`)
			sql.append(` LEFT JOIN "${spatialDataSource.tableName}_simple" AS simple ON "base"."${spatialDataSource.fidColumnName}" = "simple"."${spatialDataSource.fidColumnName}"`)
			sql.append(` WHERE "simple"."level" = ${filter.data.spatialFilter.level} AND "base"."${spatialDataSource.geometryColumnName}" && ST_GeomFromGeoJSON('${JSON.stringify(tileAsPolygon.geometry)}')`)
		}
	})

	sql.append(`) AS "spatial"`);

	_.each(relations.attribute, (attributeRelation, index) => {
		let attributeDataSource = attributeRelation.attributeDataSource;
		sql.append(` LEFT JOIN "${attributeDataSource.tableName}" AS "${attributeDataSource.key}" ON "spatial"."bFid" = "${attributeDataSource.key}"."${attributeDataSource.fidColumnName}"`)
	})

	sql.setName(`ptr_${uuid()}`);

	return sql;
}

const getDataForRelations = async (relations, filter) => {
	const data = {
		spatial: {},
		attribute: {}
	};

	const validSpatialSourceTypes = ["tiledVector"];
	if (!_.find(relations.spatial, (spatialRelation) => {
		return validSpatialSourceTypes.includes(spatialRelation.spatialDataSource.type);
	})) {
		return data;
	}

	const sql = getSqlForRelationsAndFilter(relations, filter);

	await db
		.query(sql)
		.then((pgResult) => {
			_.each(pgResult.rows, (row) => {
				data.spatial[row.spatialDataSourceKey] = data.spatial[row.spatialDataSourceKey] || {
					data: {},
					spatialIndex: {}
				};
				data.attribute[row.attributeDataSourceKey] = data.attribute[row.attributeDataSourceKey] || {}

				data.spatial[row.spatialDataSourceKey].spatialIndex[row.level] = data.spatial[row.spatialDataSourceKey].spatialIndex[row.level] || {};
				data.spatial[row.spatialDataSourceKey].spatialIndex[row.level][row.tile] = data.spatial[row.spatialDataSourceKey].spatialIndex[row.level][row.tile] || [];
				data.spatial[row.spatialDataSourceKey].spatialIndex[row.level][row.tile].push(row.fid);

				data.spatial[row.spatialDataSourceKey].data[row.fid] = JSON.parse(row.geometry);

				if (row.fid2) {
					data.attribute[row.attributeDataSourceKey][row.fid2] = row.value;
				}
			});
		})

	return data;
}

async function populateRelationsWithDataSources(relations, user) {
	let spatialDataSourceKeys = _.map(relations.spatial, (relation) => {
		return relation.spatialDataSourceKey
	});
	if (spatialDataSourceKeys.length) {
		let spatialDataSources = await getData(`dataSources`, `spatial`, user, {key: {in: spatialDataSourceKeys}});
		_.each(spatialDataSources, (dataSource) => {
			_.each(relations.spatial, (relation) => {
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
		let style = styles && styles.length && styles[0];

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
	return await getFormattedResponse(filter, user)
}