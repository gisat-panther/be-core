const _ = require('lodash');
const SQL = require('sql-template-strings');
const {v4: uuid} = require('uuid');

const ptrTileGrid = require('@gisatcz/ptr-tile-grid');

const db = require('../../../../db');
const plan = require('../../../plan');
const query = require('../../../../modules/rest/query');
const corePlan = require('../../../../applications/core/plan');

const shared = require('../../../../util/shared');


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

	let tileSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.level);

	sql.append(`SELECT`);
	sql.append(` "fid", "geometry", "spatialDataSourceKey", "tile", "level"`);

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

		_.each(filter.data.spatialFilter.tiles, (tile, index) => {
			if (index > 0) {
				sql.append(` UNION `);

			}

			let tileAsPolygon = ptrTileGrid.utils.getTileAsPolygon(tile, tileSize);

			sql.append(`SELECT`)
			sql.append(` "${spatialDataSource.fidColumnName}" AS "fid"`)
			sql.append(`, ST_AsGeoJSON("${spatialDataSource.geometryColumnName}") AS "geometry"`)
			sql.append(`, '${spatialDataSource.key}' AS "spatialDataSourceKey"`)
			sql.append(`, '${tile}' AS "tile"`)
			sql.append(`, '${filter.data.spatialFilter.level}' AS "level"`)
			sql.append(` FROM "${spatialDataSource.tableName}"`)
			sql.append(` WHERE ST_Intersects("${spatialDataSource.geometryColumnName}", ST_GeomFromGeoJSON('${JSON.stringify(tileAsPolygon.geometry)}'))`)
		})
	})

	sql.append(`) AS "spatial"`);

	_.each(relations.attribute, (attributeRelation, index) => {
		let attributeDataSource = attributeRelation.attributeDataSource;
		sql.append(` LEFT JOIN "${attributeDataSource.tableName}" AS "${attributeDataSource.key}" ON "spatial"."fid" = "${attributeDataSource.key}"."${attributeDataSource.fidColumnName}"`)
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
	const cacheKey = shared.getHash(relations, filter.data.spatialFilter);

	let mViewName = await shared.get(cacheKey);
	if (!mViewName) {
		mViewName = `ptr_${cacheKey}`;
		await shared.set(cacheKey, "#processing");
		await db.query(
			SQL`CREATE MATERIALIZED VIEW IF NOT EXISTS`
				.append(`"ptr_${cacheKey}" AS `)
				.append(sql)
				.setName(`ptr_${uuid()}`)
		)
		await shared.set(cacheKey, mViewName);
	}

	let tileKeys = [];
	if (filter.data.spatialIndex && filter.data.spatialIndex.tiles) {
		tileKeys.push(`'${filter.data.spatialIndex.tiles[0]}'`);
	} else {
		tileKeys.push(`'${filter.data.spatialFilter.tiles[0]}'`);
	}

	if (tileKeys) {
		await db.query(
			SQL`SELECT *`
				.append(` FROM "${mViewName}"`)
				.append(` WHERE "tile" IN (${tileKeys})`)
				.setName(`ptr_${uuid()}`)
		).then((pgResult) => {
			_.each(pgResult.rows, (row) => {
				data.spatial[row.spatialDataSourceKey] = data.spatial[row.spatialDataSourceKey] || {data: {}, spatialIndex: {}};
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
	}

	return data;
}

async function populateRelationsWithDataSources(relations, user) {
	let spatialDataSourceKeys = _.map(relations.spatial, (relation) => {
		return relation.spatialDataSourceKey
	});
	if (spatialDataSourceKeys.length) {
		let cachedSpatialDataSources = await shared.get(shared.getHash({key: {in: spatialDataSourceKeys}}, shared.getUserHash(user)));
		let spatialDataSources;
		if (cachedSpatialDataSources) {
			spatialDataSources = cachedSpatialDataSources;
		} else {
			spatialDataSources = await getData(`dataSources`, `spatial`, user, {key: {in: spatialDataSourceKeys}});
			await shared.set(shared.getHash({
				key: {
					in: _.map(relations.spatial, (relation) => {
						return relation.spatialDataSourceKey
					})
				}
			}, shared.getUserHash(user)), spatialDataSources);
		}
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
		let cachedAttributeDataSources = await shared.get(shared.getHash({key: {in: attributeDataSourceKeys}}, shared.getUserHash(user)));
		let attributeDataSources;
		if (cachedAttributeDataSources) {
			attributeDataSources = cachedAttributeDataSources;
		} else {
			attributeDataSources = await getData(`dataSources`, `attribute`, user, {
				key: {
					in: _.map(relations.attribute, (relation) => {
						return relation.attributeDataSourceKey
					})
				}
			});
			await shared.set(shared.getHash({key: {in: attributeDataSourceKeys}}, shared.getUserHash(user)), attributeDataSources);
		}
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

	let cachedSpatialRelations = await shared.get(shared.getHash(spatialRelationsFilter, shared.getUserHash(user)));
	if (cachedSpatialRelations) {
		relations.spatial = cachedSpatialRelations;
	} else {
		relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);
		await shared.set(shared.getHash(spatialRelationsFilter, shared.getUserHash(user)), relations.spatial);
	}

	let attributeRelationsFilter = filter.modifiers || {};
	if (filter.hasOwnProperty('styleKey')) {
		if (filter.data.hasOwnProperty('dataSourceKeys')) {
			_.set(attributeRelationsFilter, 'attributeDataSourceKey', {in: filter.data.dataSourceKeys});
		}

		let cachedStyle = await shared.get(shared.getHash({key: filter.styleKey}, shared.getUserHash(user)));
		let style;
		if (cachedStyle) {
			style = cachedStyle;
		} else {
			let styles = await getData(`metadata`, `styles`, user, {key: filter.styleKey});
			style = styles[0];
			if (style) {
				await shared.set(shared.getHash({key: filter.styleKey}, shared.getUserHash(user)), style);
			}
		}

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

		let cachedAttributeRelations = await shared.get(shared.getHash(attributeRelationsFilter, shared.getUserHash(user)));
		if (cachedAttributeRelations) {
			relations.attribute = cachedAttributeRelations;
		} else {
			relations.attribute = await getData(`relations`, `attribute`, user, attributeRelationsFilter);
			await shared.set(shared.getHash(attributeRelationsFilter, shared.getUserHash(user)), relations.attribute);
		}
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