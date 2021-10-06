const _ = require('lodash');

const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');
const shared = require('../shared');
const db = require('../../../src/db');

const GROUPS = {
    worldCerealPublic: "2dbc2120-b826-4649-939b-fff5a4a01866",
    worldCerealUser: "2597df23-94d9-41e0-91f3-7ea633ae27f2"
};

function create(request, response) {
    return handler
        .create('user', {
            user: request.user,
            body: {
                data: {
                    users: [request.body]
                }
            }
        })
        .then((r) => {
            if (r.type === result.CREATED) {
                return r.data.data.users[0].key;
            } else if (r.type === result.FORBIDDEN) {
                throw new Error(403);
            } else {
                throw new Error(500);
            }
        })
        .then((userKey) => {
            return db
                .query(`
                    BEGIN;
                    INSERT INTO "user"."userGroups" ("userKey", "groupKey") VALUES ('${userKey}', '${GROUPS.worldCerealPublic}') ON CONFLICT DO NOTHING;
                    INSERT INTO "user"."userGroups" ("userKey", "groupKey") VALUES ('${userKey}', '${GROUPS.worldCerealUser}') ON CONFLICT DO NOTHING;
                    COMMIT;
                `)
        })
        .then(() => {
            response.status(201).end();
        })
        .catch((error) => {
            if (_.isNumber(Number(error.message))) {
                response.status(error.message).end();
            } else {
                response.status(500).end();
            }
        })
}

function update(request, response) {
    return handler
        .update('user', {
            user: request.user,
            body: {
                data: {
                    users: [request.body]
                }
            }
        })
        .then((r) => {
            if (r.type === result.UPDATED) {
                response.status(200).end();
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                response.status(500).end();
            }
        })
        .catch((error) => {
            response.status(500).end();
        })
}

function remove(request, response) {
    return handler
        .deleteRecords('user', {
            user: request.user,
            body: {
                data: {
                    users: [{key: request.query.userKey}]
                }
            }
        })
        .then((r) => {
            if (r.type === result.DELETED) {
                response.status(200).end();
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                response.status(500).end();
            }
        })
        .catch((error) => {
            response.status(500).end();
        })
}

function sessionStart(request, response) {
    return shared
        .set(`${request.user.realKey}_products`, [])
        .then(() => {
            response.status(200).end();
        })
}

module.exports = {
    create,
    update,
    remove,
    sessionStart
}