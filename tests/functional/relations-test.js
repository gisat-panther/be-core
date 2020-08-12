const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');
const helper = require('../helper');

const USER_KEY = '39ed471f-8383-4283-bb8a-303cb05cadef';

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
    describe('POST /rest/relations', async function () {
        const scopeKey = 'a789c87a-d222-4550-bd29-0750353ae496';
        const placeKey = '208d7232-a50c-4e90-abf6-2593e35a2384';

        before(async function () {
            await Promise.all([
                h.createRecord('"metadata"."scope"', {key: scopeKey}),
                h.createRecord('"metadata"."place"', {key: placeKey}),
                h.grantPermissions(
                    [
                        h.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        h.PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
                    ],
                    USER_KEY
                ),
            ]);
        });

        after(async function () {
            h.revertChanges();
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
                            resourceType: 'scope',
                            permission: 'create',
                            resourceKey: scopeKey,
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'metadata',
                            resourceType: 'place',
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
                                        fidColumnName: null,
                                        layerTemplateKey: null,
                                        periodKey: null,
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
});
