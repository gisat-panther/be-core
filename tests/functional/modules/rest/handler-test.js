const handler = require('../../../../src/modules/rest/handler');
const result = require('../../../../src/modules/rest/result');
const {assert} = require('chai');

require('../../../../src/applications/index');
const db = require('../../../../src/db');
db.init();

const USER_ADMIN = {
    realKey: '2d069e3a-f77f-4a1f-aeda-50fd06c8c35d',
    key: '2d069e3a-f77f-4a1f-aeda-50fd06c8c35d',
    type: 'user',
};

const USER_CREATE_PERMS = {
    realKey: '3fdd158d-4b78-4d11-92c7-403b4adab4d8',
    key: '3fdd158d-4b78-4d11-92c7-403b4adab4d8',
    type: 'user'
}

describe('modules/retst/handler', function () {
    it('list', async function () {
        const res = await handler.list('user', {
            params: {types: 'users'},
            user: USER_ADMIN,
            body: {
                filter: {email: 'admin@example.com'},
            },
        });

        assert.isObject(res);

        delete res.data?.changes;
        res.data?.data?.users?.map((user) => delete user.data?.permissionKeys);
        assert.deepStrictEqual(res, {
            type: result.SUCCESS,
            data: {
                data: {
                    users: [
                        {
                            key: '2d069e3a-f77f-4a1f-aeda-50fd06c8c35d',
                            data: {
                                email: 'admin@example.com',
                                name: null,
                                phone: null,
                                groupKeys: null,
                            },
                            permissions: {
                                guest: {
                                    view: false,
                                    create: false,
                                    update: false,
                                    delete: false,
                                },
                                activeUser: {
                                    view: true,
                                    create: true,
                                    update: true,
                                    delete: true,
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
        });
    });

    it('create', async function () {
        const res = await handler.create('user', {
            user: USER_ADMIN,
            body: {
                data: {
                    users: [
                        {
                            key: 'c2ca8b7d-9d1b-42ae-b7bc-d18739062bb3',
                            data: {
                                email: 'new@example.com',
                            },
                        },
                    ],
                },
            },
        });

        assert.isObject(res);
        assert.deepStrictEqual(res, {
            type: result.CREATED,
            data: {
                data: {
                    users: [
                        {
                            key: 'c2ca8b7d-9d1b-42ae-b7bc-d18739062bb3',
                            data: {
                                email: 'new@example.com',
                                groupKeys: null,
                                name: null,
                                permissionKeys: null,
                                phone: null,
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
        });
    });

    it('create with create perms', async function () {
        const res = await handler.create('specific', {
            user: USER_CREATE_PERMS,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            data: {
                                data: {
                                    property: 'value'
                                }
                            },
                        },
                    ],
                },
            },
        });

        assert.isObject(res);
        assert.deepStrictEqual(res, {
            type: result.CREATED
        });
    });

    it('update', async function () {
        const res = await handler.update('user', {
            user: USER_ADMIN,
            body: {
                data: {
                    users: [
                        {
                            key: 'c2ca8b7d-9d1b-42ae-b7bc-d18739062bb3',
                            data: {name: 'New'},
                        },
                    ],
                },
            },
        });

        assert.isObject(res);
        assert.deepStrictEqual(res, {
            type: result.UPDATED,
            data: {
                data: {
                    users: [
                        {
                            key: 'c2ca8b7d-9d1b-42ae-b7bc-d18739062bb3',
                            data: {
                                email: 'new@example.com',
                                groupKeys: null,
                                name: 'New',
                                permissionKeys: null,
                                phone: null,
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
        });
    });

    it('deleteRecords', async function () {
        const res = await handler.deleteRecords('user', {
            user: USER_ADMIN,
            body: {
                data: {
                    users: [{key: 'c2ca8b7d-9d1b-42ae-b7bc-d18739062bb3'}],
                },
            },
        });

        assert.isObject(res);
        assert.deepStrictEqual(res, {type: result.DELETED});
    });
});
