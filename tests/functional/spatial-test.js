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
                        spatial: [
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
                            spatial: [
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
                    ['data', 'spatial'],
                    (ds) => _.sortBy((r) => r.key, ds),
                    data
                );
                assert.deepStrictEqual(sortedData, test.expectedResult.body);
            });
        });
    });

    describe('POST ​/rest​/dataSources​/filtered​/spatial', function () {
        const tests = [
            {
                name: 'all',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
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
                        limit: 100,
                        offset: 0,
                    },
                },
            },
            {
                name: 'filtered by ordinary column',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    filter: {nameInternal: {eq: 'raster type'}},
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
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
                        total: 1,
                        limit: 100,
                        offset: 0,
                    },
                },
            },
            {
                name: 'filtered by dependent column',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    filter: {layerName: {eq: 'lr'}},
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
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
                        total: 1,
                        limit: 100,
                        offset: 0,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(
                    url('/rest/dataSources/filtered/spatial'),
                    {
                        method: 'POST',
                        headers: test.headers,
                        body: test.body,
                    }
                );

                assert.strictEqual(response.status, 200);

                const data = await response.json();
                assert.deepStrictEqual(
                    _.omit(['changes'], data),
                    test.expectedResult.body
                );
            });
        });
    });

    describe('PUT /rest/dataSources', function () {
        const tests = [
            {
                name: 'change attr of null type',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: '1e1d2a18-9c2f-4e4a-8009-dd5cd05a52c8',
                                data: {
                                    nameInternal: 'changed name',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
                                {
                                    key: '1e1d2a18-9c2f-4e4a-8009-dd5cd05a52c8',
                                    data: {
                                        nameInternal: 'changed name',
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
                            ],
                        },
                        total: 1,
                        success: true,
                    },
                },
            },
            {
                name: 'change raster attr',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: '44e47b74-fb6c-434a-a678-340fb2c6236a',
                                data: {
                                    layerName: 'changed layer',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
                                {
                                    key: '44e47b74-fb6c-434a-a678-340fb2c6236a',
                                    data: {
                                        nameInternal: 'raster type',
                                        attribution: 'attr',
                                        type: 'raster',
                                        layerName: 'changed layer',
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
                        total: 1,
                        success: true,
                    },
                },
            },
            {
                name: 'change wms to wmts',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                data: {
                                    type: 'wmts',
                                    urls: ['l1', 'l2'],
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
                                {
                                    key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                    data: {
                                        nameInternal: 'wms type',
                                        attribution: 'wattr',
                                        type: 'wmts',
                                        urls: ['l1', 'l2'],
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
                        total: 1,
                        success: true,
                    },
                },
            },
            {
                name: 'change wmts to null',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                data: {
                                    type: null,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
                                {
                                    key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                                    data: {
                                        nameInternal: 'wms type',
                                        attribution: 'wattr',
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
                            ],
                        },
                        total: 1,
                        success: true,
                    },
                },
            },
            {
                name: 'create new dependent type',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: '2780786e-56d6-4fc0-a006-8179db9e7697',
                                data: {
                                    nameInternal: 'vector type',
                                    attribution: 'vattr',
                                    type: 'vector',
                                    layerName: 'lv',
                                    tableName: 'tv',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    body: {
                        data: {
                            spatial: [
                                {
                                    data: {
                                        attribution: 'vattr',
                                        layerName: 'lv',
                                        nameInternal: 'vector type',
                                        tableName: 'tv',
                                        type: 'vector',
                                    },
                                    key: '2780786e-56d6-4fc0-a006-8179db9e7697',
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
                        total: 1,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(url('/rest/dataSources'), {
                    method: 'PUT',
                    headers: test.headers,
                    body: test.body,
                });

                assert.strictEqual(response.status, 200);

                const data = await response.json();
                const sortedData = _.update(
                    ['data', 'spatial'],
                    (ds) => _.sortBy((r) => r.key, ds),
                    data
                );
                assert.deepStrictEqual(sortedData, test.expectedResult.body);
            });
        });
    });

    describe('DELETE /rest/dataSources', async function () {
        it('without related type', async function () {
            const getSourceKey = () =>
                db
                    .query(
                        `SELECT "sourceKey" FROM "dataSources"."dataSource" WHERE "key" = $1`,
                        ['db60a6f7-6a35-4bcb-af9a-24b8149f7bc5']
                    )
                    .then((res) =>
                        _.getOr(null, ['rows', 0, 'sourceKey'], res)
                    );

            // guard
            const sourceKey = await getSourceKey();
            assert.isNull(sourceKey);

            const response = await fetch(url('/rest/dataSources'), {
                method: 'DELETE',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: 'db60a6f7-6a35-4bcb-af9a-24b8149f7bc5',
                            },
                        ],
                    },
                }),
            });

            assert.strictEqual(response.status, 200);
        });

        it('with related type', async function () {
            const getSourceKey = () =>
                db
                    .query(
                        `SELECT "sourceKey" FROM "dataSources"."dataSource" WHERE "key" = $1`,
                        ['44e47b74-fb6c-434a-a678-340fb2c6236a']
                    )
                    .then((res) =>
                        _.getOr(null, ['rows', 0, 'sourceKey'], res)
                    );

            const relation = (sourceKey) =>
                db
                    .query(
                        `SELECT "key" FROM "dataSources"."raster" WHERE "key" = $1`,
                        [sourceKey]
                    )
                    .then((res) =>
                        _.getOr(null, ['rows', 0, 'key'], res, null)
                    );

            // guard
            const sourceKey = await getSourceKey();
            assert.isNotNull(sourceKey);
            assert.isNotNull(await relation(sourceKey));

            const response = await fetch(url('/rest/dataSources'), {
                method: 'DELETE',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        spatial: [
                            {
                                key: '44e47b74-fb6c-434a-a678-340fb2c6236a',
                            },
                        ],
                    },
                }),
            });

            assert.strictEqual(response.status, 200);
            assert.isNull(await getSourceKey());
            assert.isNull(await relation(sourceKey));
        });
    });
});
