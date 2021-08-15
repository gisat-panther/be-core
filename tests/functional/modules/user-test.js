const {assert} = require('chai');
const fetch = require('node-fetch');
const config = require('../../../config');
const db = require('../../../src/db');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

db.init();

function url(path) {
    return 'http://localhost:' + config.masterPort + path;
}

function userExists(key) {
    return db
        .query(
            `SELECT "key" FROM "${config.pgSchema.user}"."users" WHERE key = $1`,
            [key]
        )
        .then((res) => res.rows.length > 0);
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

function createNoPermissionUserToken() {
    return (
        'Bearer ' +
        jwt.sign(
            {
                key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                realKey: '7c5acddd-3625-46ef-90b3-82f829afb258',
                type: 'user',
            },
            config.jwt.secret
        )
    );
}

function createSpecificPermsAdminToken() {
    return (
        'Bearer ' +
        jwt.sign(
            {
                key: '39ed471f-8383-4283-bb8a-303cb05cadef',
                realKey: '39ed471f-8383-4283-bb8a-303cb05cadef',
                type: 'user',
            },
            config.jwt.secret
        )
    );
}

/**
 * We can't compare changes as we don't know the expected value
 */
function removeChanges(data) {
    return _.omit(data, ['changes']);
}

/**
 * Let's ignore auto generated groups
 */
function preserveKnownGroupKeys(data) {
    if (!_.has(data, ['data', 'users'])) {
        return data;
    }

    const knownGroupKeys = [
        '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
        '742b6f3f-a77e-4267-8e96-1e4cea96dec3',
        '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
        'e56f3545-57f5-44f9-9094-2750a69ef67e',
    ];

    data.data.users = data.data.users.map((u) => {
        const groupKeys = _.intersection(u.data.groupKeys, knownGroupKeys);
        if (groupKeys.length === 0) {
            u.data.groupKeys = null;
        } else {
            u.data.groupKeys = groupKeys;
        }

        return u;
    });

    return data;
}

function clearData(data) {
    return preserveKnownGroupKeys(removeChanges(data));
}

describe('modules/user', function () {
    describe('POST /rest/user/filtered/users', function () {
        const tests = [
            {
                name: 'single user',
                body: {
                    filter: {
                        key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                    },
                },
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            users: [
                                {
                                    key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                                    data: {
                                        email: 'test@noperms.example.com',
                                        name: null,
                                        phone: null,
                                        groupKeys: null,
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                            ],
                        },
                        total: 1,
                        limit: 100,
                        offset: 0,
                        success: true,
                    },
                },
            },
            {
                name: 'single user with groups',
                body: {
                    filter: {
                        key: '2bf6c1da-991a-4592-acc1-b10192db9363',
                    },
                },
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            users: [
                                {
                                    key: '2bf6c1da-991a-4592-acc1-b10192db9363',
                                    data: {
                                        email: 'testWithGroups@example.com',
                                        name: null,
                                        phone: null,
                                        groupKeys: [
                                            '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
                                            'e56f3545-57f5-44f9-9094-2750a69ef67e',
                                        ],
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                            ],
                        },
                        total: 1,
                        limit: 100,
                        offset: 0,
                        success: true,
                    },
                },
            },
            {
                name: 'ordered users (asc)',
                body: {
                    filter: {
                        key: {
                            in: [
                                '7c5acddd-3625-46ef-90b3-82f829afb258',
                                'e2f5d20e-2784-4690-a3f0-339c60b04245',
                            ],
                        },
                    },
                    order: [['key', 'ascending']],
                },
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            users: [
                                {
                                    key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                                    data: {
                                        email: 'test@noperms.example.com',
                                        name: null,
                                        phone: null,
                                        groupKeys: null,
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                                {
                                    key: 'e2f5d20e-2784-4690-a3f0-339c60b04245',
                                    data: {
                                        email: 'testWithPhone@example.com',
                                        name: null,
                                        phone: '+420123456789',
                                        groupKeys: null,
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                            ],
                        },
                        total: 2,
                        offset: 0,
                        limit: 100,
                        success: true,
                    },
                },
            },
            {
                name: 'ordered users (desc)',
                body: {
                    filter: {
                        key: {
                            in: [
                                '7c5acddd-3625-46ef-90b3-82f829afb258',
                                'e2f5d20e-2784-4690-a3f0-339c60b04245',
                            ],
                        },
                    },
                    order: [['key', 'descending']],
                },
                expectedResult: {
                    status: 200,
                    body: {
                        data: {
                            users: [
                                {
                                    key: 'e2f5d20e-2784-4690-a3f0-339c60b04245',
                                    data: {
                                        email: 'testWithPhone@example.com',
                                        name: null,
                                        phone: '+420123456789',
                                        groupKeys: null,
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                                {
                                    key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                                    data: {
                                        email: 'test@noperms.example.com',
                                        name: null,
                                        phone: null,
                                        groupKeys: null,
                                        permissionKeys: null,
                                    },
                                    permissions: {
                                        activeUser: {
                                            view: true,
                                            create: true,
                                            update: true,
                                            delete: true,
                                        },
                                        guest: {
                                            view: false,
                                            create: false,
                                            update: false,
                                            delete: false,
                                        },
                                    },
                                },
                            ],
                        },
                        total: 2,
                        offset: 0,
                        limit: 100,
                        success: true,
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                return fetch(url('/rest/user/filtered/users'), {
                    method: 'POST',
                    headers: new fetch.Headers({
                        Authorization: createAdminToken(),
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(test.body),
                }).then((response) => {
                    assert.strictEqual(
                        response.status,
                        test.expectedResult.status
                    );
                    return response.json().then((data) => {
                        assert.deepStrictEqual(
                            clearData(data),
                            test.expectedResult.body
                        );
                    });
                });
            });
        });
    });

    it('POST /rest/user/filtered/users without permissions', async function () {
        const response = await fetch(url('/rest/user/filtered/users'), {
            method: 'POST',
            headers: new fetch.Headers({
                Authorization: createNoPermissionUserToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({}),
        });
        assert.strictEqual(response.status, 200);

        const data = await response.json();
        assert.deepStrictEqual(clearData(data), {
            data: {
                users: [
                ]
            },
            limit: 100,
            offset: 0,
            total: 0,
            success: true,
        });
    });

    it('POST /rest/user/filtered/users with specific permissions', async function () {
        const response = await fetch(url('/rest/user/filtered/users'), {
            method: 'POST',
            headers: new fetch.Headers({
                Authorization: createSpecificPermsAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({}),
        });
        assert.strictEqual(response.status, 200);

        const data = await response.json();
        assert.deepStrictEqual(clearData(data), {
            data: {
                users: [
                    {
                        key: '7c5acddd-3625-46ef-90b3-82f829afb258',
                        data: {
                            email: 'test@noperms.example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: false,
                                update: false,
                                delete: false,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            limit: 100,
            offset: 0,
            total: 1,
            success: true,
        });
    });

    it('POST /rest/user', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'POST',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            data: {
                                email: 'new@example.com',
                            },
                        },
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                email: 'newWithKey@example.com',
                            },
                        },
                        {
                            key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                            data: {
                                email: 'newWithGroups@example.com',
                                groupKeys: [
                                    '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
                                    '742b6f3f-a77e-4267-8e96-1e4cea96dec3',
                                ],
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 201);

        const data = await response.json();
        data.data.users = _.sortBy(data.data.users, (u) => u.data.email);
        delete data.data.users[0].key;

        assert.deepStrictEqual(data, {
            data: {
                users: [
                    {
                        data: {
                            email: 'new@example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                    {
                        key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                        data: {
                            email: 'newWithGroups@example.com',
                            name: null,
                            phone: null,
                            groupKeys: [
                                '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
                                '742b6f3f-a77e-4267-8e96-1e4cea96dec3',
                            ],
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                    {
                        key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                        data: {
                            email: 'newWithKey@example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 3,
        });
    });

    it('POST /rest/user without permissions', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'POST',
            headers: new fetch.Headers({
                Authorization: createNoPermissionUserToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            data: {
                                email: 'new@example.com',
                            },
                        },
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                email: 'newWithKey@example.com',
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 403);

        const data = await response.json();

        assert.deepStrictEqual(data, {
            success: false,
        });
    });

    it('PUT /rest/user', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                phone: '+420111111111',
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 200);
        const data = await response.json();
        assert.deepStrictEqual(clearData(data), {
            data: {
                users: [
                    {
                        data: {
                            email: 'newWithKey@example.com',
                            name: null,
                            phone: '+420111111111',
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 1,
        });
    });

    it('PUT /rest/user changing groups', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                            data: {
                                groupKeys: [
                                    '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
                                ],
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
                users: [
                    {
                        key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                        data: {
                            email: 'newWithGroups@example.com',
                            name: null,
                            phone: null,
                            groupKeys: [
                                '52ddabec-d01a-49a0-bb4d-5ff931bd346e',
                                '742b6f3f-a77e-4267-8e96-1e4cea96dec3'
                            ],
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 1,
        });
    });

    it('PUT /rest/user removing groups', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                            data: {
                                groupKeys: [],
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
                users: [
                    {
                        key: '516743c6-37b1-4ed2-9fb6-0d8a8d2c2a9e',
                        data: {
                            email: 'newWithGroups@example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 1,
        });
    });

    it('PUT /rest/user with specific permissions', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createSpecificPermsAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                phone: '+420222222222',
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 200);
        const data = await response.json();
        assert.deepStrictEqual(clearData(data), {
            data: {
                users: [
                    {
                        data: {
                            email: 'newWithKey@example.com',
                            name: null,
                            phone: '+420222222222',
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                        permissions: {
                            activeUser: {
                                view: true,
                                create: false,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 1,
        });
    });

    it('PUT /rest/user without permissions', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createNoPermissionUserToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                phone: '+420111111111',
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 403);
        const data = await response.json();
        assert.deepStrictEqual(clearData(data), {
            success: false,
        });
    });

    it('PUT /rest/user non existing', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '682abd2e-1bd4-4524-af79-c08696f37a65',
                            data: {
                                email: 'creating@example.com',
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
                users: [
                    {
                        key: '682abd2e-1bd4-4524-af79-c08696f37a65',
                        data: {
                            email: 'creating@example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 1,
        });
    });

    it('PUT /rest/user non existing and existing', async function () {
        const response = await fetch(url('/rest/user'), {
            method: 'PUT',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: '16fab6ab-4709-4668-a28f-735d6e13d1be',
                            data: {
                                email: 'creating2@example.com',
                            },
                        },
                        {
                            key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                            data: {
                                phone: '+420222222233',
                            },
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 200);

        const data = await response.json();

        assert.deepStrictEqual(clearData(data), {
            data: {
                users: [
                    {
                        key: '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8',
                        data: {
                            email: 'newWithKey@example.com',
                            groupKeys: null,
                            name: null,
                            permissionKeys: null,
                            phone: '+420222222233',
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
                        key: '16fab6ab-4709-4668-a28f-735d6e13d1be',
                        data: {
                            email: 'creating2@example.com',
                            name: null,
                            phone: null,
                            groupKeys: null,
                            permissionKeys: null,
                        },
                        permissions: {
                            activeUser: {
                                view: true,
                                create: true,
                                update: true,
                                delete: true,
                            },
                            guest: {
                                view: false,
                                create: false,
                                update: false,
                                delete: false,
                            },
                        },
                    },
                ],
            },
            success: true,
            total: 2,
        });
    });

    it('DELETE /rest/user without permissions', async function () {
        const userKey = '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8';

        // guard
        assert.isTrue(await userExists(userKey));

        const response = await fetch(url('/rest/user'), {
            method: 'DELETE',
            headers: new fetch.Headers({
                Authorization: createNoPermissionUserToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: userKey,
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 403);
        assert.isTrue(await userExists(userKey));
    });

    it('DELETE /rest/user', async function () {
        const userKey = '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8';

        // guard
        assert.isTrue(await userExists(userKey));

        const response = await fetch(url('/rest/user'), {
            method: 'DELETE',
            headers: new fetch.Headers({
                Authorization: createAdminToken(),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    users: [
                        {
                            key: userKey,
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 200);
        assert.isFalse(await userExists(userKey));
    });
});
