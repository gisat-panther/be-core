const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');
const _ = require('lodash/fp');

db.init();

const HASH_KEY = '2fe36872-e8e2-4b11-949b-19a7cb2abd6d';

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

function periodRanges(periodKeys) {
    return db
        .query(
            'SELECT "key", "periodRange" FROM "metadata"."period" WHERE "key" = ANY($1)',
            [periodKeys]
        )
        .then((res) =>
            _.zipObj(
                _.map(_.prop('key'), res.rows),
                _.map(_.prop('periodRange'), res.rows)
            )
        );
}

describe('/rest/metadata', function () {
    describe('POST /rest/metadata/filtered/case', async function () {
        before(async function () {
            await Promise.all([
                h.createRecord('"application"."application"', {
                    key: 'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                }),
                h.createRecord('"metadata"."tag"', {
                    key: 'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                }),
                h.createRecord('"metadata"."tag"', {
                    key: 'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                }),
                h.createRecord('"metadata"."case"', {
                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                }),
                h.createRecord('"metadata"."case"', {
                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a1',
                }),
                h.createRecord('"user"."hashes"', {
                    key: HASH_KEY,
                }),
            ]);

            await Promise.all([
                h.createRecord('"relations"."caseRelation"', {
                    key: '5a08438a-6f53-4a96-997e-79cb87ba8eab',
                    parentCaseKey: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                    applicationKey: 'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                }),
                h.createRecord('"relations"."caseRelation"', {
                    key: 'd2a056e4-e5a8-457a-9468-1e27fa08032e',
                    parentCaseKey: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                    tagKey: 'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                }),
                h.createRecord('"relations"."caseRelation"', {
                    key: '02fa31ab-391f-417f-a59d-f7d7bbe3b5ef',
                    parentCaseKey: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                    tagKey: 'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                }),
            ]);

            h.newScope();
        });

        afterEach(async function () {
            h.revertChanges();
        });

        after(async function () {
            h.prevScope();
            await h.revertChanges();
        });

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
                    status: 200,
                    body: {
                        data: {
                            case: [
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                                    data: {
                                        applicationKey:
                                            'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: [
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                                        ],
                                    },
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
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a1',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: null,
                                    },
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
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                            ],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 2,
                    },
                },
            },
            {
                name: 'specific application',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    filter: {
                        applicationKey: {
                            eq: 'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                        },
                    },
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            case: [
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                                    data: {
                                        applicationKey:
                                            'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: [
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                                        ],
                                    },
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
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                            ],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 1,
                    },
                },
            },
            {
                name: 'specific tag',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    filter: {
                        tagKeys: {
                            eq: 'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                        },
                    },
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            case: [
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                                    data: {
                                        applicationKey:
                                            'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: [
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                                        ],
                                    },
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
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                            ],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 1,
                    },
                },
            },
            {
                name: 'all for guest without hash',
                headers: new fetch.Headers({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            case: [],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 0,
                    },
                },
            },
            {
                name: 'all for guest with hash',
                headers: new fetch.Headers({
                    'Content-Type': 'application/json',
                    Hash: HASH_KEY,
                }),
                before: async () => {
                    await Promise.all([
                        h.grantHashPermissions(
                            [h.PERMISSION_METADATA_CASE_VIEW],
                            HASH_KEY
                        ),
                    ]);
                },
                body: JSON.stringify({
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            case: [
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a0',
                                    data: {
                                        applicationKey:
                                            'ce42e748-16f3-48f5-8152-24f98b4d8f70',
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: [
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa0',
                                            'ce42e748-16f3-48f5-8152-24f98b4d8fa1',
                                        ],
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: false,
                                            delete: false,
                                            update: true,
                                            view: false,
                                        },
                                        guest: {
                                            create: false,
                                            delete: false,
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                                {
                                    key: '9466d6c1-6596-49c0-9729-0e3ff3ad08a1',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        tagKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: false,
                                            delete: false,
                                            update: true,
                                            view: false,
                                        },
                                        guest: {
                                            create: false,
                                            delete: false,
                                            update: true,
                                            view: false,
                                        },
                                    },
                                },
                            ],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 2,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                test.before && (await test.before());

                const response = await fetch(
                    url('/rest/metadata/filtered/case'),
                    {
                        method: 'POST',
                        headers: test.headers,
                        body: test.body,
                    }
                );

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                delete data.changes;
                assert.deepStrictEqual(data, test.expectedResult.body);
            });
        });
    });

    describe('POST /rest/metadata', function () {
        const tests = [
            {
                name: 'create period without `period` prop',
                body: JSON.stringify({
                    data: {
                        period: [
                            {
                                key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d0',
                                data: {},
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 201,
                    body: {
                        data: {
                            period: [
                                {
                                    key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d0',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: null,
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
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
                    periodRanges: {
                        '7eeea607-d9d7-4cf2-b765-fbcb1177e2d0': null,
                    },
                },
            },
            {
                name: 'create period with `period` prop',
                body: JSON.stringify({
                    data: {
                        period: [
                            {
                                key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                data: {
                                    period: '2012-03-01/P1Y',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 201,
                    body: {
                        data: {
                            period: [
                                {
                                    key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: '2012-03-01/P1Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
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
                    periodRanges: {
                        '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1':
                            '["2012-03-01 00:00:00","2013-03-01 00:00:00"]',
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'POST',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: test.body,
                });

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);

                const periods = _.get(
                    ['data', 'period'],
                    test.expectedResult.body
                );
                const periodKeys = _.map((period) => period.key, periods);
                const pr = await periodRanges(periodKeys);

                assert.deepStrictEqual(pr, test.expectedResult.periodRanges);
            });
        });
    });

    describe('PUT /rest/metadata', function () {
        const tests = [
            {
                name: 'update period with `period` prop',
                body: JSON.stringify({
                    data: {
                        period: [
                            {
                                key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                data: {
                                    period: '2012-03-01/P2Y',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            period: [
                                {
                                    key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: '2012-03-01/P2Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
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
                    periodRanges: {
                        '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1':
                            '["2012-03-01 00:00:00","2014-03-01 00:00:00"]',
                    },
                },
            },
            {
                name: 'update period omitting `period` prop',
                body: JSON.stringify({
                    data: {
                        period: [
                            {
                                key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                data: {
                                    nameDisplay: 'dis',
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            period: [
                                {
                                    key: '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1',
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: 'dis',
                                        nameInternal: null,
                                        period: '2012-03-01/P2Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
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
                    periodRanges: {
                        '7eeea607-d9d7-4cf2-b765-fbcb1177e2d1':
                            '["2012-03-01 00:00:00","2014-03-01 00:00:00"]',
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'PUT',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: test.body,
                });

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);

                const periods = _.get(
                    ['data', 'period'],
                    test.expectedResult.body
                );
                const periodKeys = _.map((period) => period.key, periods);
                const pr = await periodRanges(periodKeys);

                assert.deepStrictEqual(pr, test.expectedResult.periodRanges);
            });
        });
    });
});
