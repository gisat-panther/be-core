const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');

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
        });

        after(async function () {
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
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
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
});
