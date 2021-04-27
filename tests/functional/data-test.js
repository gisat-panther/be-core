const chai = require('chai');
const {assert, expect} = chai;

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const _ = require('lodash/fp');
const db = require('../../src/db');
const h = require('../../tests/helper');

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

describe('/rest/data/filtered', () => {
	before(async () => {
		await h.createRecord("metadata.scope", {
			key: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			nameDisplay: "Countries"
		});
		await h.createRecord("metadata.period", {
			key: "6eca6523-0756-49cb-b39d-405dcafd2386",
			nameDisplay: "2020"
		});
		await h.createRecord("metadata.attribute", {
			key: "f9f6dc0d-4b6a-4794-9243-5948d920239c",
			nameDisplay: "attribute1"
		});
		await h.createRecord("metadata.attribute", {
			key: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc",
			nameDisplay: "attribute2"
		});
		await h.createRecord("metadata.\"layerTemplate\"", {
			key: "b8cb9263-d656-4606-a326-a02e851ea0bb",
			nameDisplay: "exampleLayer"
		});
		await h.createRecord("metadata.style", {
			key: "492339a4-9a27-43ac-abf4-34f53b626a76",
			definition: {
				rules: [{
					styles: [{attributeKey: "f9f6dc0d-4b6a-4794-9243-5948d920239c"}, {attributeKey: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc"}]
				}]
			}
		});

		await h.createRecord("\"dataSources\".\"tiledVector\"", {
			key: "75d88ed5-6ad0-4ddd-a9f6-b03b60ea7dcb",
			tableName: "exampleSpatialAttributeData",
			fidColumnName: "fid",
			geometryColumnName: "geom"
		});
		await h.createRecord("\"dataSources\".\"dataSource\"", {
			key: "cf55212e-2893-46d0-8a02-cbf10cb4471d",
			type: "tiledVector",
			sourceKey: "75d88ed5-6ad0-4ddd-a9f6-b03b60ea7dcb"
		});
		await h.createRecord("\"dataSources\".\"attributeDataSource\"", {
			key: "7c11916a-20f4-4c6b-99a8-8b95bd1ec041",
			tableName: "exampleSpatialAttributeData",
			columnName: "attribute1",
			fidColumnName: "fid"
		});
		await h.createRecord("\"dataSources\".\"attributeDataSource\"", {
			key: "d0329b4c-5214-4aea-8291-bc7443b643e7",
			tableName: "exampleSpatialAttributeData",
			columnName: "attribute2",
			fidColumnName: "fid"
		});

		await h.createRecord("relations.\"spatialDataSourceRelation\"", {
			key: "352cf401-c44d-4f98-95b2-686621994aa3",
			scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386",
			spatialDataSourceKey: "cf55212e-2893-46d0-8a02-cbf10cb4471d",
			layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb"
		});
		await h.createRecord("relations.\"attributeDataSourceRelation\"", {
			key: "faa00c17-3fdc-4c25-bb49-91e1bbe0c137",
			scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386",
			attributeDataSourceKey: "7c11916a-20f4-4c6b-99a8-8b95bd1ec041",
			attributeKey: "f9f6dc0d-4b6a-4794-9243-5948d920239c",
			layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb"
		});
		await h.createRecord("relations.\"attributeDataSourceRelation\"", {
			key: "ffcd6e38-7238-4f27-a41e-dd6d3a14ff59",
			scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386",
			attributeDataSourceKey: "d0329b4c-5214-4aea-8291-bc7443b643e7",
			attributeKey: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc",
			layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb"
		});

		await h.createRecord("\"user\".permissions", {
			key: "82a74908-1b64-4320-9f1a-492079ffee43",
			resourceKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			resourceType: "scopes",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "c54502e9-6632-463e-9424-74fee7c39cfd",
			resourceKey: "6eca6523-0756-49cb-b39d-405dcafd2386",
			resourceType: "periods",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "1a7d3b1b-5048-4842-95ae-33dbe6636677",
			resourceKey: "f9f6dc0d-4b6a-4794-9243-5948d920239c",
			resourceType: "attributes",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "04ec7434-f02f-4809-ae4c-70235d241d0c",
			resourceKey: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc",
			resourceType: "attributes",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "c3784ce2-1fa4-4ad2-b768-e0fff49b3cd9",
			resourceKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
			resourceType: "layerTemplates",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "7281c06b-2e09-4992-9a98-41acefb84dcb",
			resourceKey: "492339a4-9a27-43ac-abf4-34f53b626a76",
			resourceType: "styles",
			permission: "view",
			resourceGroup: "metadata"
		});
		await h.createRecord("\"user\".permissions", {
			key: "ab916ef0-abc0-4a6f-ad5d-2d2a1d59bafb",
			resourceKey: "7c11916a-20f4-4c6b-99a8-8b95bd1ec041",
			resourceType: "attribute",
			permission: "view",
			resourceGroup: "dataSources"
		});
		await h.createRecord("\"user\".permissions", {
			key: "3d500f52-c6ad-4b51-8753-feecdde1a825",
			resourceKey: "d0329b4c-5214-4aea-8291-bc7443b643e7",
			resourceType: "attribute",
			permission: "view",
			resourceGroup: "dataSources"
		});
		await h.createRecord("\"user\".permissions", {
			key: "fca860d1-9ec4-41de-b3d5-1ff189667b9d",
			resourceKey: "cf55212e-2893-46d0-8a02-cbf10cb4471d",
			resourceType: "spatial",
			permission: "view",
			resourceGroup: "dataSources"
		});
		await h.createRecord("\"user\".permissions", {
			key: "467a8b98-2469-40d9-b5d9-da5147f52ecc",
			resourceKey: null,
			resourceType: "spatial",
			permission: "view",
			resourceGroup: "relations"
		});
		await h.createRecord("\"user\".permissions", {
			key: "915aee96-a8d6-49f1-81a1-ae1089eb5d38",
			resourceKey: null,
			resourceType: "attribute",
			permission: "view",
			resourceGroup: "relations"
		});

		await h.grantPermissions([
			"82a74908-1b64-4320-9f1a-492079ffee43",
			"c54502e9-6632-463e-9424-74fee7c39cfd",
			"1a7d3b1b-5048-4842-95ae-33dbe6636677",
			"04ec7434-f02f-4809-ae4c-70235d241d0c",
			"c3784ce2-1fa4-4ad2-b768-e0fff49b3cd9",
			"7281c06b-2e09-4992-9a98-41acefb84dcb",
			"ab916ef0-abc0-4a6f-ad5d-2d2a1d59bafb",
			"3d500f52-c6ad-4b51-8753-feecdde1a825",
			"fca860d1-9ec4-41de-b3d5-1ff189667b9d",
			"467a8b98-2469-40d9-b5d9-da5147f52ecc",
			"915aee96-a8d6-49f1-81a1-ae1089eb5d38"
		], "2d069e3a-f77f-4a1f-aeda-50fd06c8c35d");

		await db.query(
			`CREATE TABLE "public"."exampleSpatialAttributeData"
             (
                 fid        UUID PRIMARY KEY DEFAULT public.gen_random_uuid() NOT NULL,
                 geom       GEOMETRY,
                 attribute1 TEXT,
                 attribute2 INT
             );`
		);

		await db.query(
			`INSERT INTO "public"."exampleSpatialAttributeData"
                 ("fid", "geom", "attribute1", "attribute2")
             VALUES ('43c0dc2f-0c86-447f-9861-7969e1cbbe0a', ST_GeomFromText(
                     'POLYGON((14.224435 50.17743, 14.706787 50.17743, 14.706787 49.941901, 14.224435 49.941901, 14.224435 50.17743))',
                     4326), 'praha-wkt-bbox', 1),
                    ('84657e95-8ba0-4c9c-bfd9-7725fa388dfb', ST_GeomFromText(
                            'POLYGON((16.42799 49.294371, 16.727835 49.294371, 16.727835 49.10988, 16.42799 49.10988, 16.42799 49.294371))',
                            4326), 'brno-wkt-bbox', 2);`
		)

		await db.query(
			`CREATE TABLE "public"."exampleSpatialAttributeData_simple"
             (
                 fid   UUID references "public"."exampleSpatialAttributeData" ("fid"),
                 level INT,
                 json  TEXT
             );`
		)

		await db.query(
			`INSERT INTO "public"."exampleSpatialAttributeData_simple"
                 ("fid", "level", "json")
             VALUES ('43c0dc2f-0c86-447f-9861-7969e1cbbe0a', 14, ST_AsGeoJSON(
                     'POLYGON((14.224435 50.17743, 14.706787 50.17743, 14.706787 49.941901, 14.224435 49.941901, 14.224435 50.17743))')),
                    ('84657e95-8ba0-4c9c-bfd9-7725fa388dfb', 14, ST_AsGeoJSON(
                            'POLYGON((16.42799 49.294371, 16.727835 49.294371, 16.727835 49.10988, 16.42799 49.10988, 16.42799 49.294371))'));`
		)
	});

	after(async () => {
		await h.revertChanges();
		await db.query(`DROP TABLE "public"."exampleSpatialAttributeData", "public"."exampleSpatialAttributeData_simple";`);
	});

	describe("Spatial data endpoint", () => {
		it("Get filtered scope", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: "c67eaa05-64e0-4b60-8552-7adb4962e93a"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				scopes: [
					{
						data: {
							applicationKey: null,
							configuration: null,
							description: null,
							nameDisplay: "Countries",
							nameInternal: null,
							tagKeys: null
						},
						key: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/metadata/filtered/scopes'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered period", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: "6eca6523-0756-49cb-b39d-405dcafd2386"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				periods: [
					{
						data: {
							applicationKey: null,
							description: null,
							nameDisplay: "2020",
							nameInternal: null,
							period: null,
							scopeKey: null,
							tagKeys: null
						},
						key: "6eca6523-0756-49cb-b39d-405dcafd2386",
						permissions: {
							activeUser: {
								create: true,
								delete: true,
								update: true,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/metadata/filtered/periods'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered layerTemplate", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: "b8cb9263-d656-4606-a326-a02e851ea0bb"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				layerTemplates: [
					{
						data: {
							applicationKey: null,
							description: null,
							nameDisplay: "exampleLayer",
							nameInternal: null,
							scopeKey: null,
							tagKeys: null
						},
						key: "b8cb9263-d656-4606-a326-a02e851ea0bb",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/metadata/filtered/layerTemplates'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered style", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: "492339a4-9a27-43ac-abf4-34f53b626a76"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				styles: [
					{
						data: {
							applicationKey: null,
							definition: {
								rules: [
									{
										styles: [
											{
												attributeKey: "f9f6dc0d-4b6a-4794-9243-5948d920239c"
											},
											{
												attributeKey: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc"
											}
										]
									}
								]
							},
							description: null,
							nameDisplay: null,
							nameGeoserver: null,
							nameInternal: null,
							source: null,
							tagKeys: null
						},
						key: "492339a4-9a27-43ac-abf4-34f53b626a76",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/metadata/filtered/styles'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered attributes", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: {
							in: ["f9f6dc0d-4b6a-4794-9243-5948d920239c", "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc"]
						}
					},
					order: [["nameDisplay", "ascending"]]
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				attributes: [
					{
						data: {
							applicationKey: null,
							color: null,
							description: null,
							nameDisplay: "attribute1",
							nameInternal: null,
							tagKeys: null,
							type: null,
							unit: null,
							valueType: null
						},
						key: "f9f6dc0d-4b6a-4794-9243-5948d920239c",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					},
					{
						data: {
							applicationKey: null,
							color: null,
							description: null,
							nameDisplay: "attribute2",
							nameInternal: null,
							tagKeys: null,
							type: null,
							unit: null,
							valueType: null
						},
						key: "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/metadata/filtered/attributes'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered spatial dataSource", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: "cf55212e-2893-46d0-8a02-cbf10cb4471d"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				spatial: [
					{
						data: {
							attribution: null,
							fidColumnName: "fid",
							geometryColumnName: "geom",
							layerName: null,
							nameInternal: null,
							tableName: "exampleSpatialAttributeData",
							type: "tiledVector"
						},
						key: "cf55212e-2893-46d0-8a02-cbf10cb4471d",
						permissions: {
							activeUser: {
								create: true,
								delete: true,
								update: true,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/dataSources/filtered/spatial'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered attribute dataSources", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						key: {
							in: ["d0329b4c-5214-4aea-8291-bc7443b643e7", "7c11916a-20f4-4c6b-99a8-8b95bd1ec041"]
						}
					},
					order: [["columnName", "ascending"]]
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				attribute: [
					{
						data: {
							attribution: null,
							columnName: "attribute1",
							fidColumnName: "fid",
							nameInternal: null,
							tableName: "exampleSpatialAttributeData"
						},
						key: "7c11916a-20f4-4c6b-99a8-8b95bd1ec041",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					},
					{
						data: {
							attribution: null,
							columnName: "attribute2",
							fidColumnName: "fid",
							nameInternal: null,
							tableName: "exampleSpatialAttributeData"
						},
						key: "d0329b4c-5214-4aea-8291-bc7443b643e7",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true,
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false,
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/dataSources/filtered/attribute'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get filtered spatial relations", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					filter: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponseData = {
				spatial: [
					{
						data: {
							applicationKey: null,
							caseKey: null,
							layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
							periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386",
							placeKey: null,
							scenarioKey: null,
							scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
							spatialDataSourceKey: "cf55212e-2893-46d0-8a02-cbf10cb4471d"
						},
						key: "352cf401-c44d-4f98-95b2-686621994aa3",
						permissions: {
							activeUser: {
								create: false,
								delete: false,
								update: false,
								view: true
							},
							guest: {
								create: false,
								delete: false,
								update: false,
								view: false
							}
						}
					}
				]
			}

			const response = await fetch(
				url('/rest/relations/filtered/spatial'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result.data, expectedResponseData);
		})

		it("Get spatial and attribute data for Prague", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					modifiers: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					},
					layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
					styleKey: "492339a4-9a27-43ac-abf4-34f53b626a76",
					relations: {
						offset: 0,
						limit: 100
					},
					data: {
						spatialFilter: {
							level: 14,
							tiles: [
								[14.3701171875, 50.086669921875], [14.381103515625, 50.086669921875], [14.39208984375, 50.086669921875], [14.403076171875, 50.086669921875], [14.4140625, 50.086669921875], [14.425048828125, 50.086669921875], [14.43603515625, 50.086669921875], [14.447021484375, 50.086669921875], [14.4580078125, 50.086669921875], [14.3701171875, 50.07568359375], [14.381103515625, 50.07568359375], [14.39208984375, 50.07568359375], [14.403076171875, 50.07568359375], [14.4140625, 50.07568359375], [14.425048828125, 50.07568359375], [14.43603515625, 50.07568359375], [14.447021484375, 50.07568359375], [14.4580078125, 50.07568359375], [14.3701171875, 50.064697265625], [14.381103515625, 50.064697265625], [14.39208984375, 50.064697265625], [14.403076171875, 50.064697265625], [14.4140625, 50.064697265625], [14.425048828125, 50.064697265625], [14.43603515625, 50.064697265625], [14.447021484375, 50.064697265625], [14.4580078125, 50.064697265625], [14.3701171875, 50.0537109375], [14.381103515625, 50.0537109375], [14.39208984375, 50.0537109375], [14.403076171875, 50.0537109375], [14.4140625, 50.0537109375], [14.425048828125, 50.0537109375], [14.43603515625, 50.0537109375], [14.447021484375, 50.0537109375], [14.4580078125, 50.0537109375]
							]
						},
						geometry: true
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponse = {
				"spatialAttributeRelationsDataSources": {
					"total": {
						"attributeRelations": 2,
						"spatialRelations": 1
					},
					"offset": 0,
					"limit": 100,
					"spatialRelations": [],
					"attributeRelations": [],
					"spatialDataSources": [],
					"attributeDataSources": []
				},
				"spatialData": {
					"cf55212e-2893-46d0-8a02-cbf10cb4471d": {
						"data": {
							"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": {
								"type": "Polygon",
								"coordinates": [[[14.224435, 50.17743], [14.706787, 50.17743], [14.706787, 49.941901], [14.224435, 49.941901], [14.224435, 50.17743]]]
							}
						},
						"spatialIndex": {"14": {"14.3701171875,50.086669921875": ["43c0dc2f-0c86-447f-9861-7969e1cbbe0a"]}}
					}
				},
				"attributeData": {"d0329b4c-5214-4aea-8291-bc7443b643e7": {"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": 1}}
			}

			const response = await fetch(
				url('/rest/data/filtered'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result, expectedResponse);

		})

		it("Get spatial and attribute data for Prague without styleKey defined", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					modifiers: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					},
					layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
					relations: {
						offset: 0,
						limit: 100
					},
					data: {
						spatialFilter: {
							level: 14,
							tiles: [
								[14.3701171875, 50.086669921875], [14.381103515625, 50.086669921875], [14.39208984375, 50.086669921875], [14.403076171875, 50.086669921875], [14.4140625, 50.086669921875], [14.425048828125, 50.086669921875], [14.43603515625, 50.086669921875], [14.447021484375, 50.086669921875], [14.4580078125, 50.086669921875], [14.3701171875, 50.07568359375], [14.381103515625, 50.07568359375], [14.39208984375, 50.07568359375], [14.403076171875, 50.07568359375], [14.4140625, 50.07568359375], [14.425048828125, 50.07568359375], [14.43603515625, 50.07568359375], [14.447021484375, 50.07568359375], [14.4580078125, 50.07568359375], [14.3701171875, 50.064697265625], [14.381103515625, 50.064697265625], [14.39208984375, 50.064697265625], [14.403076171875, 50.064697265625], [14.4140625, 50.064697265625], [14.425048828125, 50.064697265625], [14.43603515625, 50.064697265625], [14.447021484375, 50.064697265625], [14.4580078125, 50.064697265625], [14.3701171875, 50.0537109375], [14.381103515625, 50.0537109375], [14.39208984375, 50.0537109375], [14.403076171875, 50.0537109375], [14.4140625, 50.0537109375], [14.425048828125, 50.0537109375], [14.43603515625, 50.0537109375], [14.447021484375, 50.0537109375], [14.4580078125, 50.0537109375]
							]
						},
						geometry: true
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponse = {
				"spatialAttributeRelationsDataSources": {
					"total": {
						"attributeRelations": 0,
						"spatialRelations": 1
					},
					"offset": 0,
					"limit": 100,
					"spatialRelations": [],
					"attributeRelations": [],
					"spatialDataSources": [],
					"attributeDataSources": []
				},
				"spatialData": {
					"cf55212e-2893-46d0-8a02-cbf10cb4471d": {
						"data": {
							"43c0dc2f-0c86-447f-9861-7969e1cbbe0a": {
								"type": "Polygon",
								"coordinates": [[[14.224435, 50.17743], [14.706787, 50.17743], [14.706787, 49.941901], [14.224435, 49.941901], [14.224435, 50.17743]]]
							}
						},
						"spatialIndex": {"14": {"14.3701171875,50.086669921875": ["43c0dc2f-0c86-447f-9861-7969e1cbbe0a"]}}
					}
				},
				"attributeData": {}
			}

			const response = await fetch(
				url('/rest/data/filtered'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result, expectedResponse);

		})

		it("Get spatial and attribute data for Brno", async () => {
			const request = {
				headers: new fetch.Headers({
					Authorization: createAdminToken(),
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify({
					modifiers: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					},
					layerTemplateKey: "b8cb9263-d656-4606-a326-a02e851ea0bb",
					styleKey: "492339a4-9a27-43ac-abf4-34f53b626a76",
					relations: {
						offset: 0,
						limit: 100
					},
					data: {
						spatialFilter: {
							level: 14,
							tiles: [
								[16.58935546875, 49.2022705078125], [16.5948486328125, 49.2022705078125], [16.600341796875, 49.2022705078125], [16.6058349609375, 49.2022705078125], [16.611328125, 49.2022705078125], [16.6168212890625, 49.2022705078125], [16.622314453125, 49.2022705078125], [16.6278076171875, 49.2022705078125], [16.58935546875, 49.19677734375], [16.5948486328125, 49.19677734375], [16.600341796875, 49.19677734375], [16.6058349609375, 49.19677734375], [16.611328125, 49.19677734375], [16.6168212890625, 49.19677734375], [16.622314453125, 49.19677734375], [16.6278076171875, 49.19677734375], [16.58935546875, 49.1912841796875], [16.5948486328125, 49.1912841796875], [16.600341796875, 49.1912841796875], [16.6058349609375, 49.1912841796875], [16.611328125, 49.1912841796875], [16.6168212890625, 49.1912841796875], [16.622314453125, 49.1912841796875], [16.6278076171875, 49.1912841796875], [16.58935546875, 49.185791015625], [16.5948486328125, 49.185791015625], [16.600341796875, 49.185791015625], [16.6058349609375, 49.185791015625], [16.611328125, 49.185791015625], [16.6168212890625, 49.185791015625], [16.622314453125, 49.185791015625], [16.6278076171875, 49.185791015625]
							]
						},
						geometry: true
					}
				})
			};

			const expectedStatus = 200;
			const expectedResponse = {
				"spatialAttributeRelationsDataSources": {
					"total": {
						"attributeRelations": 2,
						"spatialRelations": 1
					},
					"offset": 0,
					"limit": 100,
					"spatialRelations": [],
					"attributeRelations": [],
					"spatialDataSources": [],
					"attributeDataSources": []
				},
				"spatialData": {
					"cf55212e-2893-46d0-8a02-cbf10cb4471d": {
						"data": {
							"84657e95-8ba0-4c9c-bfd9-7725fa388dfb": {
								"type": "Polygon",
								"coordinates": [[[16.42799, 49.294371], [16.727835, 49.294371], [16.727835, 49.10988], [16.42799, 49.10988], [16.42799, 49.294371]]]
							}
						},
						"spatialIndex": {"14": {"16.58935546875,49.2022705078125": ["84657e95-8ba0-4c9c-bfd9-7725fa388dfb"]}}
					}
				},
				"attributeData": {"d0329b4c-5214-4aea-8291-bc7443b643e7": {"84657e95-8ba0-4c9c-bfd9-7725fa388dfb": 2}}
			}

			const response = await fetch(
				url('/rest/data/filtered'),
				{
					method: 'POST',
					headers: request.headers,
					body: request.body
				}
			);

			assert.strictEqual(response.status, expectedStatus);

			let result = await response.json();

			assert.deepStrictEqual(result, expectedResponse);

		})
	});
})
