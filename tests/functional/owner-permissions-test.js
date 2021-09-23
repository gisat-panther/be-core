const {assert} = require('chai');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../src/db');
const h = require('../helper');

db.init();

function url(path) {
    return 'http://localhost:' + config.masterPort + path;
}

function createUserToken(key) {
    return (
        'Bearer ' +
        jwt.sign(
            {
                key: key,
                realKey: key,
                type: 'user',
            },
            config.jwt.secret
        )
    );
}

describe('owner permissions', function () {
    const USER_KEY = '3205986f-c9f3-4eda-a42a-a441767e8373';

    before(async function () {
        await h.createRecord('"user"."users"', {
            key: USER_KEY,
            email: 'owner@example.com',
        });
        await h.grantPermission(h.PERMISSION_METADATA_PERIOD_CREATE, USER_KEY);
    });

    after(async function () {
        await h.revertChanges();
    });

    it('works', async function () {
        const response = await fetch(url('/rest/metadata'), {
            method: 'POST',
            headers: new fetch.Headers({
                Authorization: createUserToken(USER_KEY),
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                data: {
                    periods: [
                        {
                            key: 'c0c27242-dd2e-48be-9035-79c49c9a0656',
                            data: {},
                        },
                    ],
                },
            }),
        });

        assert.strictEqual(response.status, 201);

        const data = await response.json();
        assert.deepStrictEqual(data, {
            data: {
                periods: [
                    {
                        key: 'c0c27242-dd2e-48be-9035-79c49c9a0656',
                        data: {
                            nameDisplay: null,
                            nameInternal: null,
                            description: null,
                            period: null,
                            applicationKey: null,
                            scopeKey: null,
                            tagKeys: null,
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
        });
    });
});
