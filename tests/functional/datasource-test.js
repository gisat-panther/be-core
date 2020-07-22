const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');

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

describe('/rest/dataSources', function () {
    describe('POST /rest/dataSources', function () {
        const tests = [
            {
                name: 'all types',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        dataSource: [
                            {
                                key: '1e1d2a18-9c2f-4e4a-8009-dd5cd05a52c8',
                                data: {
                                    nameInternal: 'null type',
                                    attribution: 'attr',
                                    type: null,
                                },
                            },
                            {
                                key: '44e47b74-fb6c-434a-a678-340fb2c6236a',
                                data: {
                                    nameInternal: 'raster type',
                                    attribution: 'attr',
                                    type: 'raster',
                                    layerName: 'lr',
                                    tableName: 'tr',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            dataSource: [
                                {
                                    key: '1e1d2a18-9c2f-4e4a-8009-dd5cd05a52c8',
                                    data: {
                                        nameInternal: 'null type',
                                        attribution: 'attr',
                                        type: null,
                                    },
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
                                        },
                                    },
                                },
                                {
                                    key: '44e47b74-fb6c-434a-a678-340fb2c6236a',
                                    data: {
                                        nameInternal: 'raster type',
                                        attribution: 'attr',
                                        type: 'raster',
                                        layerName: 'lr',
                                        tableName: 'tr',
                                    },
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
                                        },
                                    },
                                },
                            ],
                        },
                        success: true,
                        total: 2,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(url('/rest/dataSources'), {
                    method: 'POST',
                    headers: test.headers,
                    body: test.body,
                });

                assert.strictEqual(response.status, 201);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);
            });
        });
    });
});
