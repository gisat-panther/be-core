const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const _ = require('lodash/fp');

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
                            {
                                key: 'cb007139-9b66-4e71-a092-8c779a9a1d90',
                                data: {
                                    nameInternal: 'vector type',
                                    attribution: 'vattr',
                                    type: 'vector',
                                    layerName: 'lv',
                                    tableName: 'tv',
                                },
                            },
                            {
                                key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                data: {
                                    nameInternal: 'wms type',
                                    attribution: 'wattr',
                                    type: 'wms',
                                    url: 'localhost',
                                    layers: 'wms_layers',
                                    styles: 'wms_styles',
                                    configuration: {k: 'v'},
                                },
                            },
                            {
                                key: 'afed9af4-f48c-4e0c-a22b-9f958161e55d',
                                data: {
                                    nameInternal: 'wmts type',
                                    attribution: 'wmattr',
                                    type: 'wmts',
                                    urls: ['loc1', 'loc2'],
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
                                {
                                    key: 'afed9af4-f48c-4e0c-a22b-9f958161e55d',
                                    data: {
                                        nameInternal: 'wmts type',
                                        attribution: 'wmattr',
                                        type: 'wmts',
                                        urls: ['loc1', 'loc2'],
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
                                    key: 'cb007139-9b66-4e71-a092-8c779a9a1d90',
                                    data: {
                                        nameInternal: 'vector type',
                                        attribution: 'vattr',
                                        type: 'vector',
                                        layerName: 'lv',
                                        tableName: 'tv',
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
                                    key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                    data: {
                                        nameInternal: 'wms type',
                                        attribution: 'wattr',
                                        type: 'wms',
                                        url: 'localhost',
                                        layers: 'wms_layers',
                                        styles: 'wms_styles',
                                        configuration: {k: 'v'},
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
                        total: 5,
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
                const sortedData = _.update(
                    ['data', 'dataSource'],
                    (ds) => _.sortBy((r) => r.key, ds),
                    data
                );
                assert.deepStrictEqual(sortedData, test.expectedResult.body);
            });
        });
    });
});
