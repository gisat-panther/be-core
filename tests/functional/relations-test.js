const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');
const helper = require('../helper');

const USER_KEY = '39ed471f-8383-4283-bb8a-303cb05cadef';
const HASH_KEY = '2fe36872-e8e2-4b11-949b-19a7cb2abd6d';

db.init();

function url(path) {
    return 'http://localhost:' + config.clusterPorts[0] + path;
}

function createUserToken() {
    return (
        'Bearer ' +
        jwt.sign(
            {
                key: USER_KEY,
                realKey: USER_KEY,
                type: 'user',
            },
            config.jwt.secret
        )
    );
}

describe('/rest/relations', function () {
    const scopeKey = 'a789c87a-d222-4550-bd29-0750353ae496';
    const placeKey = '208d7232-a50c-4e90-abf6-2593e35a2384';
    const periodKey = 'fbd64b2b-fe71-4f18-9759-9971b45048b2';

    before(async function () {
        await Promise.all([
            h.createRecord('"metadata"."scope"', {key: scopeKey}),
            h.createRecord('"metadata"."place"', {key: placeKey}),
            h.createRecord('"metadata"."period"', {key: periodKey}),
        ]);
        helper.newScope();
    });

    after(async function () {
        helper.prevScope();
        await h.revertChanges();
    });

    describe('POST /rest/relations', async function () {
        before(async function () {
            await Promise.all([
                h.grantPermissions(
                    [
                        h.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
                        h.PERMISSION_METADATA_PERIOD_VIEW,
                        h.PERMISSION_METADATA_PLACE_VIEW,
                        h.PERMISSION_METADATA_SCOPE_VIEW,
                    ],
                    USER_KEY
                ),
            ]);
        });

        after(async function () {
            await h.revertChanges();
        });

        const tests = [
            {
                name: 'cols with permissions without permissions',
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                data: {
                                    scopeKey: scopeKey,
                                    placeKey: placeKey,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 403,
                    body: {
                        success: false,
                    },
                },
            },
            {
                name: 'cols with permissions',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'create',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'create',
                            resourceKey: placeKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                data: {
                                    scopeKey: scopeKey,
                                    placeKey: placeKey,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 201,
                    body: {
                        data: {
                            attribute: [
                                {
                                    key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                    data: {
                                        applicationKey: null,
                                        areaTreeLevelKey: null,
                                        attributeDataSourceKey: null,
                                        attributeKey: null,
                                        attributeSetKey: null,
                                        caseKey: null,
                                        layerTemplateKey: null,
                                        periodKey: null,
                                        placeKey: placeKey,
                                        scenarioKey: null,
                                        scopeKey: scopeKey,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
                                            update: false,
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
                test.before && (await test.before());

                const response = await fetch(url('/rest/relations'), {
                    method: 'POST',
                    headers: test.headers,
                    body: test.body,
                });

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);
            });
        });
    });

    describe('POST /rest/relations/filtered/attribute', async function () {
        beforeEach(async function () {
            await h.createRecord('"user"."hashes"', {
                key: HASH_KEY,
            })

            await Promise.all([
                h.grantPermissions(
                    [
                        h.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
                    ],
                    USER_KEY
                ),
                h.grantHashPermission(h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW, HASH_KEY)
            ]);
        });

        afterEach(async function () {
            await h.revertChanges();
        });

        const tests = [
            {
                name: 'cols with permissions without permission',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scope',
                            permission: 'view',
                            resourceKey: scopeKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({}),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            attribute: [],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 0,
                    },
                },
            },
            {
                name: 'cols with permissions',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'view',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'view',
                            resourceKey: placeKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({}),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            attribute: [
                                {
                                    key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                    data: {
                                        applicationKey: null,
                                        areaTreeLevelKey: null,
                                        attributeDataSourceKey: null,
                                        attributeKey: null,
                                        attributeSetKey: null,
                                        caseKey: null,
                                        layerTemplateKey: null,
                                        periodKey: null,
                                        placeKey: placeKey,
                                        scenarioKey: null,
                                        scopeKey: scopeKey,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: true,
                                            delete: false,
                                            update: false,
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
            {
                name: 'cols with permissions without permission with hash',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scope',
                            permission: 'view',
                            resourceKey: scopeKey,
                        }),
                    ]);
                    await helper.grantHashPermissions(permissions, HASH_KEY);
                },
                headers: new fetch.Headers({
                    Hash: HASH_KEY,
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({}),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            attribute: [],
                        },
                        limit: 100,
                        offset: 0,
                        success: true,
                        total: 0,
                    },
                },
            },
            {
                name: 'cols with permissions with hash',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scope',
                            permission: 'view',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'place',
                            permission: 'view',
                            resourceKey: placeKey,
                        }),
                    ]);
                    await helper.grantHashPermissions(permissions, HASH_KEY);
                },
                headers: new fetch.Headers({
                    Hash: HASH_KEY,
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({}),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            attribute: [
                                {
                                    key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                    data: {
                                        applicationKey: null,
                                        areaTreeLevelKey: null,
                                        attributeDataSourceKey: null,
                                        attributeKey: null,
                                        attributeSetKey: null,
                                        caseKey: null,
                                        fidColumnName: null,
                                        layerTemplateKey: null,
                                        periodKey: null,
                                        placeKey: placeKey,
                                        scenarioKey: null,
                                        scopeKey: scopeKey,
                                    },
                                    permissions: {
                                        activeUser: {
                                            create: false,
                                            delete: false,
                                            update: false,
                                            view: false,
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
                test.before && (await test.before());

                const response = await fetch(
                    url('/rest/relations/filtered/attribute'),
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

    describe('PUT /rest/relations', async function () {
        beforeEach(async function () {
            await Promise.all([
                h.grantPermissions(
                    [
                        h.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
                        h.PERMISSION_METADATA_PERIOD_VIEW,
                        h.PERMISSION_METADATA_PLACE_VIEW,
                        h.PERMISSION_METADATA_SCOPE_VIEW,
                    ],
                    USER_KEY
                ),
            ]);
        });

        afterEach(async function () {
            await h.revertChanges();
        });

        const tests = [
            {
                name: 'cols with permissions without old col permission',
                before: async function () {
                    const permissions = [
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                        '6a6a40a7-a944-4db8-8f74-672ef011dec7',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'update',
                            resourceKey: placeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'periods',
                            permission: 'update',
                            resourceKey: periodKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                data: {
                                    periodKey: periodKey,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 403,
                    body: {
                        success: false,
                    },
                },
            },
            {
                name: 'cols with permissions without new col permission',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'update',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'update',
                            resourceKey: placeKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                data: {
                                    periodKey: periodKey,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 403,
                    body: {
                        success: false,
                    },
                },
            },
            {
                name: 'cols with permissions',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                        '6a6a40a7-a944-4db8-8f74-672ef011dec7',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'update',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'update',
                            resourceKey: placeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[2],
                            resourceGroup: 'metadata',
                            resourceType: 'periods',
                            permission: 'update',
                            resourceKey: periodKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                data: {
                                    periodKey: periodKey,
                                },
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            attribute: [
                                {
                                    key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                                    data: {
                                        applicationKey: null,
                                        areaTreeLevelKey: null,
                                        attributeDataSourceKey: null,
                                        attributeKey: null,
                                        attributeSetKey: null,
                                        caseKey: null,
                                        layerTemplateKey: null,
                                        periodKey: periodKey,
                                        placeKey: placeKey,
                                        scenarioKey: null,
                                        scopeKey: scopeKey,
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
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                test.before && (await test.before());

                const response = await fetch(url('/rest/relations'), {
                    method: 'PUT',
                    headers: test.headers,
                    body: test.body,
                });

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);
            });
        });
    });

    describe('PUT /rest/relations', async function () {
        const scopeKey = 'a789c87a-d222-4550-bd29-0750353ae496';
        const placeKey = '208d7232-a50c-4e90-abf6-2593e35a2384';
        const periodKey = 'fbd64b2b-fe71-4f18-9759-9971b45048b2';

        beforeEach(async function () {
            await Promise.all([
                h.grantPermissions(
                    [
                        h.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
                        h.PERMISSION_METADATA_PERIOD_VIEW,
                        h.PERMISSION_METADATA_PLACE_VIEW,
                        h.PERMISSION_METADATA_SCOPE_VIEW,
                    ],
                    USER_KEY
                ),
            ]);
        });

        afterEach(async function () {
            await h.revertChanges();
        });

        const tests = [
            {
                name: 'cols with permissions without col permission',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'update',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'update',
                            resourceKey: placeKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 403,
                    body: {
                        success: false,
                    },
                },
            },
            {
                name: 'cols with permissions',
                before: async function () {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                        '6a6a40a7-a944-4db8-8f74-672ef011dec7',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'metadata',
                            resourceType: 'scopes',
                            permission: 'update',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'places',
                            permission: 'update',
                            resourceKey: placeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[2],
                            resourceGroup: 'metadata',
                            resourceType: 'periods',
                            permission: 'update',
                            resourceKey: periodKey,
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                headers: new fetch.Headers({
                    Authorization: createUserToken(),
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                    data: {
                        attribute: [
                            {
                                key: 'e896b814-47f9-4f56-b4bb-552d9d912134',
                            },
                        ],
                    },
                }),
                expectedResult: {
                    status: 200,
                    body: {},
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                test.before && (await test.before());

                const response = await fetch(url('/rest/relations'), {
                    method: 'DELETE',
                    headers: test.headers,
                    body: test.body,
                });

                assert.strictEqual(response.status, test.expectedResult.status);

                const data = await response.json();
                assert.deepStrictEqual(data, test.expectedResult.body);
            });
        });
    });
});
