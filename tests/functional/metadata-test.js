const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');
const _ = require('lodash/fp');
const cf = require('../../src/modules/rest/custom-fields');

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

    describe('POST /rest/metadata/filtered/period', async function () {
        before(async function () {
            await Promise.all([
                h.createRecord('"metadata"."period"', {
                    key: '3a2da626-6ac2-4c31-bf53-e1a7929d2e00',
                    period: '2010-01-01T01:00:00.000Z/P2Y',
                    periodRange:
                        '["2010-01-01T01:00:00.000Z","2012-01-01T01:00:00.000Z"]',
                }),
                h.createRecord('"metadata"."period"', {
                    key: '3a2da626-6ac2-4c31-bf53-e1a7929d2e01',
                    period: '2014-01-01T01:00:00.000Z/P2Y',
                    periodRange:
                        '["2014-01-01T01:00:00.000Z","2016-01-01T01:00:00.000Z"]',
                }),
            ]);
        });

        after(async function () {
            await h.revertChanges();
        });

        const tests = [
            {
                name: 'all overlapping',
                body: JSON.stringify({
                    filter: {
                        period: {overlaps: '2011-02-01T01:00:00.000Z/P3Y'},
                    },
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    body: {
                        data: {
                            period: [
                                {
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: '2010-01-01T01:00:00.000Z/P2Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    key: '3a2da626-6ac2-4c31-bf53-e1a7929d2e00',
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
                                {
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: '2014-01-01T01:00:00.000Z/P2Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    key: '3a2da626-6ac2-4c31-bf53-e1a7929d2e01',
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
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 2,
                    },
                },
            },
            {
                name: 'one overlapping',
                body: JSON.stringify({
                    filter: {
                        period: {overlaps: '2012-01-01T01:00:00.000Z'},
                    },
                    order: [['key', 'ascending']],
                }),
                expectedResult: {
                    body: {
                        data: {
                            period: [
                                {
                                    data: {
                                        applicationKey: null,
                                        description: null,
                                        nameDisplay: null,
                                        nameInternal: null,
                                        period: '2010-01-01T01:00:00.000Z/P2Y',
                                        scopeKey: null,
                                        tagKeys: null,
                                    },
                                    key: '3a2da626-6ac2-4c31-bf53-e1a7929d2e00',
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
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 1,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                const response = await fetch(
                    url('/rest/metadata/filtered/period'),
                    {
                        method: 'POST',
                        headers: new fetch.Headers({
                            Authorization: createAdminToken(),
                            'Content-Type': 'application/json',
                        }),
                        body: test.body,
                    }
                );

                assert.strictEqual(response.status, 200);

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

    describe('translations', function () {
        it('POST /rest/metadata', async function () {
            const response = await fetch(url('/rest/metadata'), {
                method: 'POST',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        scope: [
                            {
                                key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                data: {},
                                translations: {
                                    cs: {
                                        nameDisplay: 'csNameDisplay',
                                        description: 'csOnlyDescription',
                                    },
                                    en: {
                                        nameDisplay: 'enNameDisplay',
                                        enOnlyProp: 'enOnlyPvalue',
                                    },
                                },
                            },
                        ],
                    },
                }),
            });

            assert.strictEqual(response.status, 201);
        });

        describe('POST /rest/metadata/filtered/scope', async function () {
            const tests = [
                {
                    name: 'cs,en',
                    body: {
                        filter: {
                            key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                        },
                        translations: ['cs', 'en'],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                translations: {
                                    cs: {
                                        description: 'csOnlyDescription',
                                        nameDisplay: 'csNameDisplay',
                                    },
                                    en: {
                                        enOnlyProp: 'enOnlyPvalue',
                                    },
                                },
                            },
                        ],
                    },
                },
                {
                    name: 'en,cs',
                    body: {
                        filter: {
                            key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                        },
                        translations: ['en', 'cs'],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                translations: {
                                    cs: {
                                        description: 'csOnlyDescription',
                                    },
                                    en: {
                                        nameDisplay: 'enNameDisplay',
                                        enOnlyProp: 'enOnlyPvalue',
                                    },
                                },
                            },
                        ],
                    },
                },
            ];

            tests.forEach((test) => {
                it(test.name, async function () {
                    const response = await fetch(
                        url('/rest/metadata/filtered/scope'),
                        {
                            method: 'POST',
                            headers: new fetch.Headers({
                                Authorization: createAdminToken(),
                                'Content-Type': 'application/json',
                            }),
                            body: JSON.stringify(test.body),
                        }
                    );

                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    const data = await response.json();

                    const interestingData = _.map(
                        _.pick(['key', 'translations']),
                        data.data.scope
                    );
                    assert.deepStrictEqual(
                        interestingData,
                        test.expectedResult.body
                    );
                });
            });
        });

        describe('POST /rest/metadata/filtered/scope - sorting', async function () {
            before(async function () {
                await Promise.all([
                    cf.storeNew(
                        {client: db, group: 'metadata'},
                        {
                            new: {tIntegerField: {type: 'integer'}},
                        }
                    ),
                    // 0
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        nameDisplay: 'default0',
                    }),
                    h.createTranslation({
                        resourceKey: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        resourceGroup: 'metadata',
                        resourceType: 'scope',
                        locale: 'cs',
                        field: 'nameDisplay',
                        value: JSON.stringify('cs0'),
                    }),
                    h.createTranslation({
                        resourceKey: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        resourceGroup: 'metadata',
                        resourceType: 'scope',
                        locale: 'cs',
                        field: 'tIntegerField',
                        value: 2,
                    }),
                    h.createTranslation({
                        resourceKey: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        resourceGroup: 'metadata',
                        resourceType: 'scope',
                        locale: 'en',
                        field: 'nameDisplay',
                        value: JSON.stringify('en0'),
                    }),
                    // 1
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                        nameDisplay: 'default1',
                    }),
                    h.createTranslation({
                        resourceKey: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                        resourceGroup: 'metadata',
                        resourceType: 'scope',
                        locale: 'cs',
                        field: 'nameDisplay',
                        value: JSON.stringify('cs1'),
                    }),
                    h.createTranslation({
                        resourceKey: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                        resourceGroup: 'metadata',
                        resourceType: 'scope',
                        locale: 'cs',
                        field: 'tIntegerField',
                        value: 10,
                    }),
                    // nameDisplay: missing `en`
                ]);
            });

            after(async function () {
                await h.revertChanges();
            });

            const tests = [
                {
                    name: 'cs - asc (string)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['cs'],
                        order: [['nameDisplay', 'ascending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                        ],
                    },
                },
                {
                    name: 'cs - desc (string)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['cs'],
                        order: [['nameDisplay', 'descending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
                {
                    name: 'en, default - asc (string)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['en'],
                        order: [['nameDisplay', 'ascending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
                {
                    name: 'en, default - desc (string)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['en'],
                        order: [['nameDisplay', 'descending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                        ],
                    },
                },
                {
                    name: 'cs - asc (integer)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['cs'],
                        order: [['tIntegerField', 'ascending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                        ],
                    },
                },
                {
                    name: 'cs - desc (integer)',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        translations: ['cs'],
                        order: [['tIntegerField', 'descending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
            ];

            tests.forEach((test) => {
                it(test.name, async function () {
                    const response = await fetch(
                        url('/rest/metadata/filtered/scope'),
                        {
                            method: 'POST',
                            headers: new fetch.Headers({
                                Authorization: createAdminToken(),
                                'Content-Type': 'application/json',
                            }),
                            body: JSON.stringify(test.body),
                        }
                    );

                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    const data = await response.json();

                    const interestingData = _.map(
                        _.pick(['key']),
                        data.data.scope
                    );
                    assert.deepStrictEqual(
                        interestingData,
                        test.expectedResult.body
                    );
                });
            });
        });

        describe('PUT /rest/metadata', function () {
            it('make some changes', async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'PUT',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        data: {
                            scope: [
                                {
                                    key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                    data: {},
                                    translations: {
                                        cs: {
                                            nameDisplay: 'csNameDisplay2',
                                            someProp: 'csNew',
                                        },
                                        en: {
                                            nameDisplay: 'enNameDisplay2',
                                            someEnProp: 'enSomeNew',
                                        },
                                    },
                                },
                            ],
                        },
                    }),
                });

                assert.strictEqual(response.status, 200);
            });

            it('make sure that type cannot be changed', async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'PUT',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        data: {
                            scope: [
                                {
                                    key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                    data: {},
                                    translations: {
                                        cs: {
                                            nameDisplay: 1,
                                        },
                                    },
                                },
                            ],
                        },
                    }),
                });

                assert.strictEqual(response.status, 400);
            });
        });

        describe('POST /rest/metadata/filtered/scope after changes', async function () {
            const tests = [
                {
                    name: 'cs,en',
                    body: {
                        filter: {
                            key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                        },
                        translations: ['cs', 'en'],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                translations: {
                                    cs: {
                                        description: 'csOnlyDescription',
                                        nameDisplay: 'csNameDisplay2',
                                        someProp: 'csNew',
                                    },
                                    en: {
                                        enOnlyProp: 'enOnlyPvalue',
                                        someEnProp: 'enSomeNew',
                                    },
                                },
                            },
                        ],
                    },
                },
                {
                    name: 'en,cs',
                    body: {
                        filter: {
                            key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                        },
                        translations: ['en', 'cs'],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: '1e675bdd-c92c-4150-a067-c49ff239b380',
                                translations: {
                                    cs: {
                                        description: 'csOnlyDescription',
                                        someProp: 'csNew',
                                    },
                                    en: {
                                        nameDisplay: 'enNameDisplay2',
                                        enOnlyProp: 'enOnlyPvalue',
                                        someEnProp: 'enSomeNew',
                                    },
                                },
                            },
                        ],
                    },
                },
            ];

            tests.forEach((test) => {
                it(test.name, async function () {
                    const response = await fetch(
                        url('/rest/metadata/filtered/scope'),
                        {
                            method: 'POST',
                            headers: new fetch.Headers({
                                Authorization: createAdminToken(),
                                'Content-Type': 'application/json',
                            }),
                            body: JSON.stringify(test.body),
                        }
                    );

                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    const data = await response.json();

                    const interestingData = _.map(
                        _.pick(['key', 'translations']),
                        data.data.scope
                    );
                    assert.deepStrictEqual(
                        interestingData,
                        test.expectedResult.body
                    );
                });
            });
        });
    });

    describe('custom fields', function () {
        it('POST /rest/metadata', async function () {
            const response = await fetch(url('/rest/metadata'), {
                method: 'POST',
                headers: new fetch.Headers({
                    Authorization: createAdminToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        scope: [
                            {
                                key: 'bf866d9d-b20a-4518-87e5-caff38645886',
                                data: {
                                    stringCustomField: 'stringv',
                                    numberCustomField: 6,
                                },
                            },
                        ],
                    },
                }),
            });

            assert.strictEqual(response.status, 201);

            const data = await response.json();
            assert.deepStrictEqual(data, {
                data: {
                    scope: [
                        {
                            key: 'bf866d9d-b20a-4518-87e5-caff38645886',
                            data: {
                                applicationKey: null,
                                configuration: null,
                                description: null,
                                nameDisplay: null,
                                nameInternal: null,
                                numberCustomField: 6,
                                stringCustomField: 'stringv',
                                tagKeys: null,
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
            });
        });

        describe('PUT /rest/metadata', function () {
            it('make some changes', async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'PUT',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        data: {
                            scope: [
                                {
                                    key: 'bf866d9d-b20a-4518-87e5-caff38645886',
                                    data: {
                                        numberCustomField: 7,
                                        newField: 'new',
                                    },
                                },
                            ],
                        },
                    }),
                });

                assert.strictEqual(response.status, 200);

                const data = await response.json();
                assert.deepStrictEqual(data, {
                    data: {
                        scope: [
                            {
                                key: 'bf866d9d-b20a-4518-87e5-caff38645886',
                                data: {
                                    applicationKey: null,
                                    configuration: null,
                                    description: null,
                                    nameDisplay: null,
                                    nameInternal: null,
                                    numberCustomField: 7,
                                    stringCustomField: 'stringv',
                                    newField: 'new',
                                    tagKeys: null,
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
                });
            });

            it('make sure that type cannot be changed', async function () {
                const response = await fetch(url('/rest/metadata'), {
                    method: 'PUT',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        data: {
                            scope: [
                                {
                                    key: 'bf866d9d-b20a-4518-87e5-caff38645886',
                                    data: {
                                        numberCustomField: 'should be number',
                                    },
                                },
                            ],
                        },
                    }),
                });

                assert.strictEqual(response.status, 400);
            });
        });

        describe('POST /rest/metadata/filtered/scope - sorting', async function () {
            before(async function () {
                await Promise.all([
                    cf.storeNew(
                        {client: db, group: 'metadata'},
                        {
                            new: {
                                stringField: {type: 'string'},
                                integerField: {type: 'integer'},
                            },
                        }
                    ),
                    // 0
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        __customColumns: JSON.stringify({
                            stringField: '10',
                            integerField: 2,
                        }),
                    }),
                    // 1
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                        __customColumns: JSON.stringify({
                            stringField: '2',
                            integerField: 10,
                        }),
                    }),
                ]);
            });

            after(async function () {
                await h.revertChanges();
            });

            const tests = [
                {
                    name: 'string - asc',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        order: [['stringField', 'ascending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                        ],
                    },
                },
                {
                    name: 'string - desc',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        order: [['stringField', 'descending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
                {
                    name: 'integer - asc',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        order: [['integerField', 'ascending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                        ],
                    },
                },
                {
                    name: 'integer - desc',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                        },
                        order: [['integerField', 'descending']],
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                            },
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
            ];

            tests.forEach((test) => {
                it(test.name, async function () {
                    const response = await fetch(
                        url('/rest/metadata/filtered/scope'),
                        {
                            method: 'POST',
                            headers: new fetch.Headers({
                                Authorization: createAdminToken(),
                                'Content-Type': 'application/json',
                            }),
                            body: JSON.stringify(test.body),
                        }
                    );

                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    const data = await response.json();

                    const interestingData = _.map(
                        _.pick(['key']),
                        data.data.scope
                    );
                    assert.deepStrictEqual(
                        interestingData,
                        test.expectedResult.body
                    );
                });
            });

            it('unknown field', async function () {
                const response = await fetch(
                    url('/rest/metadata/filtered/scope'),
                    {
                        method: 'POST',
                        headers: new fetch.Headers({
                            Authorization: createAdminToken(),
                            'Content-Type': 'application/json',
                        }),
                        body: JSON.stringify({
                            order: [['unknown', 'ascending']],
                        }),
                    }
                );

                assert.strictEqual(response.status, 400);
            });
        });

        describe('POST /rest/metadata/filtered/scope - filtering', async function () {
            before(async function () {
                await Promise.all([
                    cf.storeNew(
                        {client: db, group: 'metadata'},
                        {
                            new: {
                                stringField: {type: 'string'},
                                integerField: {type: 'integer'},
                            },
                        }
                    ),
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                        __customColumns: JSON.stringify({
                            stringField: '10',
                            integerField: 2,
                        }),
                    }),
                    h.createRecord('"metadata"."scope"', {
                        key: 'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                        __customColumns: JSON.stringify({
                            stringField: '2',
                            integerField: 10,
                        }),
                    }),
                ]);
            });

            after(async function () {
                await h.revertChanges();
            });

            const tests = [
                {
                    name: 'string - eq',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                            stringField: '10',
                        },
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
                {
                    name: 'integer - eq',
                    body: {
                        filter: {
                            key: {
                                in: [
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                                    'f1e4a9ab-04fc-4939-a180-111cf54c2311',
                                ],
                            },
                            integerField: 2,
                        },
                    },
                    expectedResult: {
                        status: 200,
                        body: [
                            {
                                key: 'f1e4a9ab-04fc-4939-a180-111cf54c2310',
                            },
                        ],
                    },
                },
            ];

            tests.forEach((test) => {
                it(test.name, async function () {
                    const response = await fetch(
                        url('/rest/metadata/filtered/scope'),
                        {
                            method: 'POST',
                            headers: new fetch.Headers({
                                Authorization: createAdminToken(),
                                'Content-Type': 'application/json',
                            }),
                            body: JSON.stringify(test.body),
                        }
                    );

                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    const data = await response.json();

                    const interestingData = _.map(
                        _.pick(['key']),
                        data.data.scope
                    );
                    assert.deepStrictEqual(
                        interestingData,
                        test.expectedResult.body
                    );
                });
            });

            it('unknown field', async function () {
                const response = await fetch(
                    url('/rest/metadata/filtered/scope'),
                    {
                        method: 'POST',
                        headers: new fetch.Headers({
                            Authorization: createAdminToken(),
                            'Content-Type': 'application/json',
                        }),
                        body: JSON.stringify({
                            filter: {
                                unknown: 2,
                            },
                        }),
                    }
                );

                assert.strictEqual(response.status, 400);
            });
        });
    });
});
