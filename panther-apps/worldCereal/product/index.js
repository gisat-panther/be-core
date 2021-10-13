const uuidByString = require('uuid-by-string');
const _ = require('lodash');

const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');
const shared = require('../shared');
const db = require('../../../src/db');
const s2tiles = require('../s2tiles');

const GROUPS = {
    worldCerealPublic: "2dbc2120-b826-4649-939b-fff5a4a01866",
    worldCerealUser: "2597df23-94d9-41e0-91f3-7ea633ae27f2"
}

function getKeyByProductId(productMetadata) {
    return uuidByString(productMetadata.id)
}

function setAsPublic(productKey) {
    return db
        .query(`SELECT "key" FROM "user"."permissions" WHERE "permission" = 'view' AND "resourceKey" = '${productKey}'`)
        .then((pgResult) => pgResult.rows[0].key)
        .then((permissionKey) => {
            return db
                .query(`INSERT INTO "user"."groupPermissions" ("groupKey", "permissionKey") VALUES ('${GROUPS.worldCerealPublic}', '${permissionKey}') ON CONFLICT DO NOTHING;`)
        })
}

function create(request, response) {
    return handler
        .create('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId(request.body),
                            data: {
                                tileKeys: request.body.tiles.map((tile) => tile.tile),
                                geometry: request.body.geometry,
                                data: request.body
                            }
                        }
                    ]
                }
            }
        })
        .then((r) => {
            if (r.type === result.CREATED) {
                return r.data.data.worldCerealProductMetadata[0];
            } else if (r.type === result.FORBIDDEN) {
                throw new Error(403);
            } else {
                throw new Error(500);
            }
        })
        .then((worldCerealProductMetadata) => {
            if (!worldCerealProductMetadata) {
                throw new Error(500);
            }

            if (worldCerealProductMetadata.data.data.public) {
                return setAsPublic(worldCerealProductMetadata.key);
            }
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
        .update('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId(request.body),
                            data: {
                                tileKeys: request.body.tiles.map((tile) => tile.tile),
                                geometry: request.body.geometry,
                                data: request.body
                            }
                        }
                    ]
                }
            }
        })
        .then((r) => {
            if (r.type === result.UPDATED) {
                return r.data.data.worldCerealProductMetadata[0];
            } else if (r.type === result.FORBIDDEN) {
                throw new Error(403);
            } else {
                throw new Error(500);
            }
        })
        .then((worldCerealProductMetadata) => {
            if (!worldCerealProductMetadata) {
                throw new Error(500);
            }

            if (worldCerealProductMetadata.data.data.public) {
                return setAsPublic(worldCerealProductMetadata.key);
            }
        })
        .then(() => {
            response.status(200).end();
        })
        .catch((error) => {
            if (_.isNumber(Number(error.message))) {
                response.status(error.message).end();
            } else {
                response.status(500).end();
            }
        })
}

function remove(request, response) {
    return handler
        .deleteRecords('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId({ id: request.query.productId })
                        }
                    ]
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

function view(request, response) {
    let tiles = [];
    return Promise
        .resolve()
        .then(async () => {
            if (request.body.geometry) {
                tiles = await s2tiles.getTilesByGeometry(request.body.geometry);
            } else {
                tiles = await s2tiles.getTilesAll();
            }
        })
        .then(() => {
            let filter = {};

            if (request.body.geometry) {
                filter.geometry = {
                    geometry_overlaps: request.body.geometry
                }

                filter.tileKeys = {
                    overlaps: tiles
                }
            }

            if (request.body.key) {
                filter.key = request.body.key;
            }

            return handler
                .list('specific', {
                    params: { types: 'worldCerealProductMetadata' },
                    user: request.user,
                    body: {
                        filter
                    }
                })
        })
        .then(async (r) => {
            if (r.type === result.SUCCESS) {
                const sharedStorageKey = `${request.user.realKey}_products`;

                let sentProductKeys = await shared.get(sharedStorageKey) || [];

                let products = r.data.data.worldCerealProductMetadata.map((product) => {
                    if (!sentProductKeys.includes(product.key)) {
                        sentProductKeys.push(product.key);

                        return Object.assign(
                            {},
                            product,
                            {
                                data: {
                                    ...product.data,
                                    tileKeys: undefined,
                                    geometry: undefined
                                },
                                permissions: undefined
                            }
                        );
                    } else {
                        return Object.assign(
                            {},
                            product,
                            {
                                data: undefined,
                                permissions: undefined
                            }
                        );
                    }
                });

                await shared.set(sharedStorageKey, sentProductKeys);

                response.status(200).send({
                    products,
                    tiles
                }

                );
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                console.log(JSON.stringify(r));
                response.status(500).end();
            }
        })
        .catch((error) => {
            console.log(error);
            response.status(500).end();
        })
}

module.exports = {
    create,
    update,
    remove,
    view,
    getKeyByProductId
}