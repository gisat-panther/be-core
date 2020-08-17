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

function formatData(rawData) {
	console.log(rawData);

	let formattedResponse = {
		spatialRelations: [],
		attributeRelations: [],
		spatialDataSources: [],
		attributeDataSources: [],
		spatialData: {},
		attributeData: {}
	};

	rawData.spatial.forEach((spatialRelation) => {
		formattedResponse.spatialData[spatialRelation.spatialDataSourceKey] = spatialRelation.data;
		formattedResponse.spatialDataSources.push(spatialRelation.spatialDataSource);

		delete spatialRelation.spatialDataSourceKey;
		delete spatialRelation.spatialDataSource;

		formattedResponse.spatialRelations.push(spatialRelation);
	})

	rawData.attribute.forEach((attributeRelation) => {
		formattedResponse.attributeData[attributeRelation.attributeDataSourceKey] = attributeRelation.data;
		formattedResponse.attributeDataSources.push(attributeRelation.attributeDataSource);

		delete attributeRelation.attributeDataSourceKey;
		delete attributeRelation.attributeDataSource;

		formattedResponse.attributeRelations.push(attributeRelation);
	})

	return formattedResponse;
}

async function getPopulatedRelationsByFilter(filter, user) {
	let relations = await getRelationsByFilter(filter, user);

	for (const relation of relations.spatial) {
		let spatialDataSource = await getData(`dataSources`, `spatial`, user, {key: relation.spatialDataSourceKey});
		relation.spatialDataSource = spatialDataSource[0];
	}

	for (const relation of relations.attribute) {
		let attributeDataSource = await getData(`dataSources`, `attribute`, user, {key: relation.attributeDataSourceKey});
		relation.attributeDataSource = attributeDataSource[0];
	}

	if (filter.geometry) {
		for (const relation of relations.spatial) {
			relation.data = await getDataForRelation(relation, filter.spatialFilter);
		}
	}

	for (const relation of relations.attribute) {
		relation.data = await getDataForRelation(relation, filter.spatialFilter);
	}

	return relations;
}

async function getRelationsByFilter(filter, user) {
	let relations = {
		attribute: [],
		spatial: []
	};

	if (filter.geometry) {
		relations.spatial = await getData(`relations`, 'spatial', user, filter.relationsFilter);
	}

	if (filter.hasOwnProperty("attributeFilter")) {
		filter.relationsFilter = _.merge(filter.relationsFilter, filter.attributeFilter);
	}

	relations.attribute = await getData(`relations`, `attribute`, user, filter.relationsFilter);

	return relations;
}

async function getDataSourcesByFilter(filter, user) {
	let relations = await getRelationsByFilter(filter, user);
	return getDataSourcesByRelations(relations.spatial, relations.attribute, user);

}

async function getDataSourcesByRelations(spatialRelations, attributeRelations, user) {
	let dataSources = {
		spatial: [],
		attribute: []
	};

	if (spatialRelations) {
		dataSources.spatial = await getData(`dataSources`, `spatial`, user, {key: {in: _.map(spatialRelations, `spatialDataSourceKey`)}})
	}

	if (attributeRelations) {
		dataSources.attribute = await getData(`dataSources`, `attribute`, user, {key: {in: _.map(attributeRelations, `attributeDataSourceKey`)}})
	}

	return dataSources;
}

async function getDataForRelation(relation, spatialFilter) {
	if (spatialFilter) {
		let gridSize = ptrTileGrid.utils.getGridSizeForLevel(spatialFilter.level);
		let geojsonTileGrid = ptrTileGrid.utils.getTileGridAsGeoJSON(spatialFilter.tiles, gridSize);

		let sqlGeometries = _.map(geojsonTileGrid.features, (feature) => {
			return `ST_GeomFromGeoJSON('${JSON.stringify(feature.geometry)}')`;
		})
		let sqlGeometry = `ST_Collect(ARRAY[${sqlGeometries.join(', ')}]::GEOMETRY[])`;
	}

	if (relation.hasOwnProperty('attributeDataSource')) {
		let queryResult = await db.query(
			`SELECT "${relation.fidColumnName}", "${relation.attributeDataSource.columnName}" FROM "public"."${relation.attributeDataSource.tableName}"`
		);

		return queryResult.rows;
	} else if (relation.hasOwnProperty('spatialDataSource')) {
		let geometryColumnName = "geometry"; // todo made this parameterized
		let queryResult = await db.query(
			`SELECT "${relation.fidColumnName}", ST_AsGeoJSON("${geometryColumnName}") AS geometry FROM "public"."${relation.spatialDataSource.tableName}"`
		);

		return _.map(queryResult.rows, (row) => {
			row["geometry"] = JSON.parse(row["geometry"]);
			return row;
		});
	}
}

async function getFormattedResponse(filter, user) {
	let rawData = await getPopulatedRelationsByFilter(filter, user);
	return formatData(rawData);
}

module.exports = async function (filter, user) {
	return await getFormattedResponse(filter, user);
}