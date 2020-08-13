const {assert} = require('chai');
const permission = require('../../src/permission');
const helper = require('../helper');

const USER_KEY = '39ed471f-8383-4283-bb8a-303cb05cadef';

describe('permission', function () {
    describe('userHasAllPermissions', function () {
        afterEach(async function () {
            await helper.revertChanges();
        });

        const tests = [
            {
                name: 'missing resource permission',
                user: {realKey: USER_KEY},
                permissions: [
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'create',
                    },
                ],
                expectedResult: false,
            },
            {
                name: 'resoure permission',
                before: async () => {
                    await helper.grantPermission(
                        helper.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                        USER_KEY
                    );
                },
                user: {realKey: USER_KEY},
                permissions: [
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'create',
                    },
                ],
                expectedResult: true,
            },
            {
                name: 'multiple resoure permissions',
                before: async () => {
                    await helper.grantPermissions(
                        [
                            helper.PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
                            helper.PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
                        ],
                        USER_KEY
                    );
                },
                user: {realKey: USER_KEY},
                permissions: [
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'create',
                    },
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'update',
                    },
                ],
                expectedResult: true,
            },
            {
                name: 'resource permission with missing key',
                before: async () => {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'relations',
                            resourceType: 'attribute',
                            permission: 'create',
                            resourceKey: '50b14751-82b2-47ed-8018-c4a080f5d4d2',
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                user: {realKey: USER_KEY},
                permissions: [
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'create',
                        resourceKey: [
                            '50b14751-82b2-47ed-8018-c4a080f5d4d2',
                            '5f6c4178-f7a2-4507-a261-664b9e2f3f89',
                        ],
                    },
                ],
                expectedResult: false,
            },
            {
                name: 'resource permission with keys',
                before: async () => {
                    const permissions = [
                        '3c93904f-2cf8-4f57-9fbf-58079a9ae854',
                        'd5ec756f-60c3-427d-ba36-c6599de5b9b4',
                    ];
                    await Promise.all([
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[0],
                            resourceGroup: 'relations',
                            resourceType: 'attribute',
                            permission: 'create',
                            resourceKey: '50b14751-82b2-47ed-8018-c4a080f5d4d2',
                        }),
                        helper.createRecord('"user"."permissions"', {
                            key: permissions[1],
                            resourceGroup: 'relations',
                            resourceType: 'attribute',
                            permission: 'create',
                            resourceKey: '5f6c4178-f7a2-4507-a261-664b9e2f3f89',
                        }),
                    ]);
                    await helper.grantPermissions(permissions, USER_KEY);
                },
                user: {realKey: USER_KEY},
                permissions: [
                    {
                        resourceGroup: 'relations',
                        resourceType: 'attribute',
                        permission: 'create',
                        resourceKey: [
                            '50b14751-82b2-47ed-8018-c4a080f5d4d2',
                            '5f6c4178-f7a2-4507-a261-664b9e2f3f89',
                        ],
                    },
                ],
                expectedResult: true,
            },
        ];

        tests.forEach((test) => {
            it(test.name, async function () {
                test.before && (await test.before());

                assert.strictEqual(
                    await permission.userHasAllPermissions(
                        test.user,
                        test.permissions
                    ),
                    test.expectedResult
                );
            });
        });
    });
});
