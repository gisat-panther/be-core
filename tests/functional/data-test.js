const {assert} = require('chai');
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
					relationsFilter: {
						scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
						periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
					},
					attributeKeys: [],
					geometry: true,
					order: [["f9f6dc0d-4b6a-4794-9243-5948d920239c", "ascending"]],
					offset: 0,
					limit: 100,
					featureKeys: [],
					spatialFilter: {
						tiles: [[[14.23828125, 50.2294921875], [14.2822265625, 50.2294921875], [14.326171875, 50.2294921875], [14.3701171875, 50.2294921875], [14.4140625, 50.2294921875], [14.4580078125, 50.2294921875], [14.501953125, 50.2294921875], [14.5458984375, 50.2294921875], [14.58984375, 50.2294921875]], [[14.23828125, 50.185546875], [14.2822265625, 50.185546875], [14.326171875, 50.185546875], [14.3701171875, 50.185546875], [14.4140625, 50.185546875], [14.4580078125, 50.185546875], [14.501953125, 50.185546875], [14.5458984375, 50.185546875], [14.58984375, 50.185546875]], [[14.23828125, 50.1416015625], [14.2822265625, 50.1416015625], [14.326171875, 50.1416015625], [14.3701171875, 50.1416015625], [14.4140625, 50.1416015625], [14.4580078125, 50.1416015625], [14.501953125, 50.1416015625], [14.5458984375, 50.1416015625], [14.58984375, 50.1416015625]], [[14.23828125, 50.09765625], [14.2822265625, 50.09765625], [14.326171875, 50.09765625], [14.3701171875, 50.09765625], [14.4140625, 50.09765625], [14.4580078125, 50.09765625], [14.501953125, 50.09765625], [14.5458984375, 50.09765625], [14.58984375, 50.09765625]], [[14.23828125, 50.0537109375], [14.2822265625, 50.0537109375], [14.326171875, 50.0537109375], [14.3701171875, 50.0537109375], [14.4140625, 50.0537109375], [14.4580078125, 50.0537109375], [14.501953125, 50.0537109375], [14.5458984375, 50.0537109375], [14.58984375, 50.0537109375]], [[14.23828125, 50.009765625], [14.2822265625, 50.009765625], [14.326171875, 50.009765625], [14.3701171875, 50.009765625], [14.4140625, 50.009765625], [14.4580078125, 50.009765625], [14.501953125, 50.009765625], [14.5458984375, 50.009765625], [14.58984375, 50.009765625]], [[14.23828125, 49.9658203125], [14.2822265625, 49.9658203125], [14.326171875, 49.9658203125], [14.3701171875, 49.9658203125], [14.4140625, 49.9658203125], [14.4580078125, 49.9658203125], [14.501953125, 49.9658203125], [14.5458984375, 49.9658203125], [14.58984375, 49.9658203125]], [[14.23828125, 49.921875], [14.2822265625, 49.921875], [14.326171875, 49.921875], [14.3701171875, 49.921875], [14.4140625, 49.921875], [14.4580078125, 49.921875], [14.501953125, 49.921875], [14.5458984375, 49.921875], [14.58984375, 49.921875]], [[14.23828125, 49.8779296875], [14.2822265625, 49.8779296875], [14.326171875, 49.8779296875], [14.3701171875, 49.8779296875], [14.4140625, 49.8779296875], [14.4580078125, 49.8779296875], [14.501953125, 49.8779296875], [14.5458984375, 49.8779296875], [14.58984375, 49.8779296875]]],
						level: 12
					}
				}),
				expectedResult: {
					body: {}
				}
			},
			// {
			// 	name: 'relationsFilter - all features, single attribute',
			// 	headers: new fetch.Headers({
			// 		Authorization: createAdminToken(),
			// 		'Content-Type': 'application/json',
			// 	}),
			// 	body: JSON.stringify({
			// 		relationsFilter: {
			// 			scopeKey: "c67eaa05-64e0-4b60-8552-7adb4962e93a",
			// 			periodKey: "6eca6523-0756-49cb-b39d-405dcafd2386"
			// 		},
			// 		attributeKeys: [],
			// 		geometry: true,
			// 		order: [["f9f6dc0d-4b6a-4794-9243-5948d920239c", "ascending"]],
			// 		offset: 0,
			// 		limit: 100,
			// 		featureKeys: [],
			// 		spatialFilter: {
			// 			tiles: [],
			// 			level: 3
			// 		},
			// 		attributeFilter: {
			// 			attributeKey: {
			// 				in: [
			// 					"f9f6dc0d-4b6a-4794-9243-5948d920239c"
			// 				]
			// 			}
			// 		}
			// 	}),
			// 	expectedResult: {
			// 		body: {}
			// 	}
			// },
			// {
			// 	name: 'dataSourceFilter',
			// 	headers: new fetch.Headers({
			// 		Authorization: createAdminToken(),
			// 		'Content-Type': 'application/json',
			// 	}),
			// 	body: JSON.stringify({
			// 		dataSourceFilter: {
			// 			relationKey: {
			// 				in: []
			// 			}
			// 		},
			// 		attributeKeys: [],
			// 		geometry: true,
			// 		order: [["attributeKey", "ascending"]],
			// 		offset: 0,
			// 		limit: 100,
			// 		featureKeys: [],
			// 		spatialFilter: {
			// 			tiles: [],
			// 			level: 3
			// 		},
			// 		attributeFilter: {
			// 			attributeKey: {
			// 				in: [12, 13]
			// 			}
			// 		}
			// 	}),
			// 	expectedResult: {
			// 		body: {}
			// 	}
			// },
			// {
			// 	name: 'dataFilters',
			// 	headers: new fetch.Headers({
			// 		Authorization: createAdminToken(),
			// 		'Content-Type': 'application/json',
			// 	}),
			// 	body: JSON.stringify({
			// 		dataFilters: [
			// 			{
			// 				dataSourceKey: "",
			// 				fidColumnName: ""
			// 			}
			// 		],
			// 		attributeKeys: [],
			// 		geometry: true,
			// 		order: [["attributeKey", "ascending"]],
			// 		offset: 0,
			// 		limit: 100,
			// 		featureKeys: [],
			// 		spatialFilter: {
			// 			tiles: [],
			// 			level: 3
			// 		},
			// 		attributeFilter: {
			// 			attributeKey: {
			// 				in: [12, 13]
			// 			}
			// 		}
			// 	}),
			// 	expectedResult: {
			// 		body: {}
			// 	}
			// }
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

				assert.strictEqual(response.status, 200);

				let result = await response.json();

				assert.deepStrictEqual(result, test.expectedResult.body);
			});
		})
	});
})
