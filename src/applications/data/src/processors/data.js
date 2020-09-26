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
			spatialData: rawData.data.spatial,
			attributeData: rawData.data.attribute
		},
		total: {
			spatialRelations: rawData.spatial.length,
			attributeRelations: rawData.attribute.length
		},
		limit: filter.relations.limit,
		offset: filter.relations.offset
	};

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
		spatial: {},
		attribute: {}
	};

	const gridSize = ptrTileGrid.utils.getGridSizeForLevel(filter.data.spatialFilter.level);

	const tileGeometries = {};
	_.each(filter.data.spatialFilter.tiles, (tile) => {
		tileGeometries[`${tile[0]},${tile[1]}`] = ptrTileGrid.utils.getTileAsPolygon(tile, gridSize);
	});
	const spatialIndex = filter.data.spatialIndex || filter.data.spatialFilter;

	for (const spatialRelation of relations.spatial) {
		const spatialDataSource = spatialRelation.spatialDataSource;

		const columns = [];
		const joins = [];
		const wheres = [];

		columns.push(`"${spatialDataSource.key}"."${spatialDataSource.fidColumnName}"`);

		if (filter.data.geometry) {
			columns.push(`st_asgeojson("${spatialDataSource.key}"."${spatialDataSource.geometryColumnName}") AS "${spatialDataSource.geometryColumnName}"`);
		}

		const relatedAttributeRelations = _.filter(relations.attribute, (attributeRelation) => {
			return attributeRelation.layerTemplateKey === spatialRelation.layerTemplateKey;
		});

		for (const attributeRelation of relatedAttributeRelations) {
			const attributeDataSource = attributeRelation.attributeDataSource;
			columns.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" AS "${attributeDataSource.key}"`);
			joins.push(`LEFT JOIN "${attributeDataSource.tableName}" AS "${attributeDataSource.key}" ON "${attributeDataSource.key}"."${attributeDataSource.fidColumnName}" = "${spatialDataSource.key}"."${spatialDataSource.fidColumnName}"`)

			if (filter.data.attributeFilter && filter.data.attributeFilter.hasOwnProperty(attributeRelation.attributeKey)) {
				const attributeFilter = filter.data.attributeFilter[attributeRelation.attributeKey];
				if (_.isObject(attributeFilter)) {
					let filterMethods = _.keys(attributeFilter);
					for (const filterMethod of filterMethods) {
						switch (filterMethod) {
							case "in":
								wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" IN ('${attributeFilter.in.join("', '")}')`);
								break;
							case "notin":
								wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" NOT IN ('${attributeFilter.notin.join("', '")}')`);
								break;
							case "gt":
								if (_.isString(attributeFilter.gt)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" > '${attributeFilter.gt}'`);
								} else if (_.isNumber(attributeFilter.gt)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" > ${attributeFilter.gt}`);
								}
								break;
							case "lt":
								if (_.isString(attributeFilter.lt)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" < '${attributeFilter.lt}'`);
								} else if (_.isNumber(attributeFilter.lt)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" < ${attributeFilter.lt}`);
								}
								break;
							case "eq":
								if (_.isString(attributeFilter.eq)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" = '${attributeFilter.eq}'`);
								} else if (_.isNumber(attributeFilter.eq)) {
									wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" = ${attributeFilter.eq}`);
								}
								break;
						}
					}
				} else if (_.isString(attributeFilter)) {
					wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" = '${attributeFilter}'`)
				} else if (_.isNumber(attributeFilter)) {
					wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" = ${attributeFilter}`)
				} else if (_.isNull(attributeFilter)) {
					wheres.push(`"${attributeDataSource.key}"."${attributeDataSource.columnName}" IS NULL`);
				}
			}
		}

		wheres.push(`st_intersects("${spatialDataSource.key}"."${spatialDataSource.geometryColumnName}", st_geomfromgeojson('${JSON.stringify(tileGeometries[spatialIndex.tiles[0]].geometry)}'))`);

		const sqlQueryString = `SELECT ${columns.join(", ")} FROM "${spatialDataSource.tableName}" AS "${spatialDataSource.key}" ${joins.join(" ")} ${wheres.length ? "WHERE " + wheres.join(" AND ") : ""}`

		const queryResult = await db.query(sqlQueryString);

		data.spatial[spatialDataSource.key] = {
			data: {},
			spatialIndex: {
				[filter.data.spatialFilter.level]: {
					[spatialIndex.tiles[0]]: _.map(queryResult.rows, spatialDataSource.fidColumnName)
				}
			}
		}

		for (const attributeRelation of relatedAttributeRelations) {
			const attributeDataSource = attributeRelation.attributeDataSource;
			data.attribute[attributeDataSource.key] = {};
		}

		_.each(queryResult.rows, (row) => {
			if(row.hasOwnProperty(spatialDataSource.geometryColumnName)) {
				data.spatial[spatialDataSource.key].data[row[spatialDataSource.fidColumnName]] = JSON.parse(row[spatialDataSource.geometryColumnName]);
			}

			_.each(_.keys(data.attribute), (attributeDataSourceKey) => {
				if (row.hasOwnProperty(attributeDataSourceKey)) {
					data.attribute[attributeDataSourceKey][row[spatialDataSource.fidColumnName]] = row[attributeDataSourceKey];
				}
			})
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

	let spatialRelationsFilter = filter.modifiers;
	if (filter.hasOwnProperty('layerTemplateKey')) {
		_.set(spatialRelationsFilter, 'layerTemplateKey', filter.layerTemplateKey);
	}

	if (filter.data.hasOwnProperty('dataSourceKeys')) {
		_.set(spatialRelationsFilter, 'spatialDataSourceKey', {in: filter.data.dataSourceKeys});
	}

	relations.spatial = await getData(`relations`, 'spatial', user, spatialRelationsFilter);

	let attributeRelationsFilter = filter.modifiers;
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