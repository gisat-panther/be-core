const chai = require('chai');
const {assert, expect} = chai;

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const _ = require('lodash/fp');
const db = require('../../src/db');

db.init();

function url(path) {
	return 'http://localhost:' + config.clusterPorts[0] + path;
}

function createAdminToken() {
	return (
		'Bearer ' +
		jwt.sign(
			{
				key: '2d069e3a-f77f-4a1f-aeda-50fd06c8c35d',
				realKey: '2d069e3a-f77f-4a1f-aeda-50fd06c8c35d',
				type: 'user',
			},
			config.jwt.secret
		)
	);
}

describe('/rest/data/filtered', function () {
	describe('POST /rest/data/filtered', async function () {
		let tests = [
			{
				name: 'relationsFilter - all features, all attributes',
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					modifiers: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					},

					// which layer you want
					layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
					// or
					// areaTreeLevelKey: "uuid",

					// get attributes from style
					styleKey: "492339a4-9a27-43ac-abf4-34f53b626a76",

					// pagination for relations (& data sources)
					relations: {
						offset: 0,
						limit: 10
					},

					// options for spatial & attributes data
					data: {
						// list of features you want
						// featureKeys: [],

						// which tiles you want (pseudo-pagination)
						// spatialIndex: {
						// 	tiles: [[lon, lat]],
						// },

						// part of attribute endpoint
						// attributeIndex: {
						//     order: [["attribute-uuid", "ascending"], ...],
						//     offset: 0,
						//     limit: 10
						// },

						// extent
						spatialFilter: {
							tiles: _.flatten([[[14.23828125,50.1416015625],[14.2822265625,50.1416015625],[14.326171875,50.1416015625],[14.3701171875,50.1416015625],[14.4140625,50.1416015625],[14.4580078125,50.1416015625],[14.501953125,50.1416015625],[14.5458984375,50.1416015625]],[[14.23828125,50.09765625],[14.2822265625,50.09765625],[14.326171875,50.09765625],[14.3701171875,50.09765625],[14.4140625,50.09765625],[14.4580078125,50.09765625],[14.501953125,50.09765625],[14.5458984375,50.09765625]],[[14.23828125,50.0537109375],[14.2822265625,50.0537109375],[14.326171875,50.0537109375],[14.3701171875,50.0537109375],[14.4140625,50.0537109375],[14.4580078125,50.0537109375],[14.501953125,50.0537109375],[14.5458984375,50.0537109375]],[[14.23828125,50.009765625],[14.2822265625,50.009765625],[14.326171875,50.009765625],[14.3701171875,50.009765625],[14.4140625,50.009765625],[14.4580078125,50.009765625],[14.501953125,50.009765625],[14.5458984375,50.009765625]]]),
							level: 12
						},

						// filter features by attribute value
						attributeFilter: {
							'43c0dc2f-0c86-447f-9861-7969e1cbbe0a': {
								in: [2]
							}
						},
						geometry: true,

						// use data source keys as filter or add them to filter
						// dataSourceKeys: ["dataSource-uuid"]
					}
				}),
				expectedResult: {
					body: {
						"data": {
							"spatialRelations": [
								{
									"key": "352cf401-c44d-4f98-95b2-686621994aa3",
									"data": {
										"scopeKey": "c67eaa05-64e0-4b60-8552-7adb4962e93a",
										"periodKey": "6eca6523-0756-49cb-b39d-405dcafd2386",
										"placeKey": null,
										"layerTemplateKey": "b8cb9263-d656-4606-a326-a02e851ea0bb",
										"scenarioKey": null,
										"caseKey": null,
										"applicationKey": null
									}
								}
							],
							"attributeRelations": [
								{
									"key": "ffcd6e38-7238-4f27-a41e-dd6d3a14ff59",
									"data": {
										"scopeKey": "c67eaa05-64e0-4b60-8552-7adb4962e93a",
										"periodKey": "6eca6523-0756-49cb-b39d-405dcafd2386",
										"placeKey": null,
										"layerTemplateKey": "b8cb9263-d656-4606-a326-a02e851ea0bb",
										"scenarioKey": null,
										"caseKey": null,
										"attributeSetKey": null,
										"attributeKey": "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc",
										"areaTreeLevelKey": null,
										"applicationKey": null
									}
								},
								{
									"key": "faa00c17-3fdc-4c25-bb49-91e1bbe0c137",
									"data": {
										"scopeKey": "c67eaa05-64e0-4b60-8552-7adb4962e93a",
										"periodKey": "6eca6523-0756-49cb-b39d-405dcafd2386",
										"placeKey": null,
										"layerTemplateKey": "b8cb9263-d656-4606-a326-a02e851ea0bb",
										"scenarioKey": null,
										"caseKey": null,
										"attributeSetKey": null,
										"attributeKey": "f9f6dc0d-4b6a-4794-9243-5948d920239c",
										"areaTreeLevelKey": null,
										"applicationKey": null
									}
								}
							],
							"spatialDataSources": [
								{
									"key": "cf55212e-2893-46d0-8a02-cbf10cb4471d",
									"data": {
										"nameInternal": null,
										"attribution": null,
										"type": "vector",
										"layerName": null,
										"tableName": "exampleSpatialAttributeData",
										"fidColumnName": "key",
										"geometryColumnName": "geometry"
									}
								}
							],
							"attributeDataSources": [
								{
									"key": "d0329b4c-5214-4aea-8291-bc7443b643e7",
									"data": {
										"nameInternal": null,
										"attribution": null,
										"tableName": "exampleSpatialAttributeData",
										"columnName": "attribute2",
										"fidColumnName": "key"
									}
								},
								{
									"key": "7c11916a-20f4-4c6b-99a8-8b95bd1ec041",
									"data": {
										"nameInternal": null,
										"attribution": null,
										"tableName": "exampleSpatialAttributeData",
										"columnName": "attribute1",
										"fidColumnName": "key"
									}
								}
							],
							"spatialData": {
								"cf55212e-2893-46d0-8a02-cbf10cb4471d": {
									"data": {
										"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": {
											"type": "Polygon",
											"coordinates": [
												[
													[
														14.224435,
														50.17743
													],
													[
														14.706787,
														50.17743
													],
													[
														14.706787,
														49.941901
													],
													[
														14.224435,
														49.941901
													],
													[
														14.224435,
														50.17743
													]
												]
											]
										}
									},
									"spatialIndex": {
										"14.23828125,50.1416015625": [
											"43c0dc2f-0c86-447f-9861-7969e1cbbe0a"
										]
									}
								}
							},
							"attributeData": {
								"d0329b4c-5214-4aea-8291-bc7443b643e7": {
									"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": 1
								},
								"7c11916a-20f4-4c6b-99a8-8b95bd1ec041": {
									"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": "praha-wkt-bbox"
								}
							}
						},
						"total": {
							"spatialRelations": 1,
							"attributeRelations": 2
						},
						"limit": 10,
						"offset": 0
					}
				}
			}
		];

		tests.forEach(function (test) {
			it(test.name, async function () {
				const response = await fetch(
					url('/rest/data/filtered'),
					{
						method: 'POST',
						headers: test.headers,
						body: test.body
					}
				);

				// assert.strictEqual(response.status, 200);

				let result = await response.json();

				// expect(result).to.deep.equalInAnyOrder(test.expectedResult.body);
			});
		})
	});
})
