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

const STAC_REQUIRED_PROPERTIES = [
    'id',
    'links',
    'properties',
    'properties.mgrs:utm_zone',
    'properties.mgrs:latitude_band',
    'properties.mgrs:grid_square',
    'properties.start_datetime',
    'properties.end_datetime',
    'properties.season',
    'properties.aez_id',
    'properties.aez_group',
    'properties.model',
    'properties.training_refids',
    'properties.product',
    'properties.public',
    'properties.tile_collection_id',
    'assets',
    'assets.product',
    'assets.product.href',
    'assets.metafeatures',
    'assets.metafeatures.href',
    'assets.confidence',
    'assets.confidence.href'
]

function getKeyByProductId(productMetadata) {
    return uuidByString(productMetadata.properties.tile_collection_id);
}

function setAsPublic(productKey) {
    return db
        .query(`SELECT "key" FROM "user"."permissions" WHERE "permission" = 'view' AND "resourceKey" = '${productKey}';`)
        .then((pgResult) => pgResult.rows[0].key)
        .then((permissionKey) => {
            return db
                .query(`INSERT INTO "user"."groupPermissions" ("groupKey", "permissionKey") VALUES ('${GROUPS.worldCerealPublic}', '${permissionKey}') ON CONFLICT DO NOTHING;`)
        })
}

function setAsPrivate(productKey) {
    return db
        .query(`SELECT "key" FROM "user"."permissions" WHERE "permission" = 'view' AND "resourceKey" = '${productKey}';`)
        .then((pgResult) => pgResult.rows[0].key)
        .then((permissionKey) => {
            return db
                .query(`DELETE FROM "user"."groupPermissions" WHERE "groupKey" = '${GROUPS.worldCerealPublic}' AND "permissionKey" = '${permissionKey}';`)
        })
}

function checkRequiredProperties(stacList) {
    return Promise
        .resolve()
        .then(() => {
            _.each(stacList, (stac) => {
                _.each(STAC_REQUIRED_PROPERTIES, (requiredPropertyPath) => {
                    if (!_.has(stac, requiredPropertyPath)) {
                        throw new Error(`Property ${requiredPropertyPath} not found!`);
                    }
                })
            })
        })
}

function ensureArray(requestBody) {
    if (_.isArray(requestBody)) {
        return requestBody;
    } else {
        return [requestBody];
    }
}

function getProductMetadataFromStac(stac) {
    return Promise
        .resolve()
        .then(() => {
            return {
                "key": getKeyByProductId(stac),
                "data": {
                    "data": {
                        "tile_collection_id": stac.properties.tile_collection_id,
                        "sos": stac.properties.start_datetime,
                        "eos": stac.properties.end_datetime,
                        "season": stac.properties.season,
                        "aez_id": stac.properties.aez_id,
                        "aez_group": stac.properties.aez_group,
                        "model": stac.properties.model,
                        "training_refids": stac.properties.training_refids,
                        "product": stac.properties.product,
                        "public": stac.properties.public,
                        "tiles": [
                            {
                                "id": stac.id,
                                "tile": `${stac.properties["mgrs:utm_zone"]}${stac.properties["mgrs:latitude_band"]}${stac.properties["mgrs:grid_square"]}`,
                                "product": stac.assets.product.href,
                                "metafeatures": stac.assets.metafeatures.href,
                                "confidence": stac.assets.confidence.href,
                                "stac": _.find(stac.links, (link) => link.rel === "self").href
                            }
                        ]
                    }
                }
            }
        })
}

function getGeometryForS2TilesByKeys(s2TileKeys) {
    return db
        .query(`SELECT ST_AsGeoJSON(ST_Extent(geom)) AS geometry FROM world_cereal_s2_tiles WHERE tile IN ('${s2TileKeys.join("', '")}');`)
        .then((queryResult) => {
            if (queryResult.rows[0] && queryResult.rows[0].geometry) {
                return JSON.parse(queryResult.rows[0].geometry);
            } else {
                return null
            }
        });
}

function mergeWith(object, source) {
    return _.mergeWith(
        object,
        source,
        (objValue, srcValue, key) => {
            if (_.isArray(objValue) && key === "tiles") {
                let tiles = {};

                _.each(objValue.concat(srcValue), (tile) => {
                    tiles[tile.id] = tile;
                });

                return _.orderBy(_.map(tiles), ['tile']);
            }
        }
    );
}

function create(request, response) {
    let rawProductMetadataToCreateOrUpdate = {};

    return Promise
        .resolve()
        .then(() => {
            return ensureArray(request.body);
        })
        .then((stacList) => {
            return checkRequiredProperties(stacList)
                .then(() => stacList);
        })
        .then(async (stacList) => {
            for (let stac of stacList) {
                let productMetadata = await getProductMetadataFromStac(stac);
                if (!rawProductMetadataToCreateOrUpdate[productMetadata.key]) {
                    rawProductMetadataToCreateOrUpdate[productMetadata.key] = _.assign({}, productMetadata);
                } else {
                    rawProductMetadataToCreateOrUpdate[productMetadata.key] = mergeWith(rawProductMetadataToCreateOrUpdate[productMetadata.key], productMetadata);
                }
            }
        })
        .then(() => {
            return handler
                .list('specific', {
                    params: { types: 'worldCerealProductMetadata' },
                    user: request.user,
                    body: {
                        filter: {
                            key: {
                                in: _.map(rawProductMetadataToCreateOrUpdate, 'key')
                            }
                        }
                    }
                })
                .then((list) => list.data.data.worldCerealProductMetadata);
        })
        .then((existingProductMetadataList) => {
            _.each(rawProductMetadataToCreateOrUpdate, (rawProduct, rawProductKey) => {
                let existingProduct = _.find(existingProductMetadataList, (product) => {
                    return product.key === rawProductKey;
                });

                if (existingProduct) {
                    delete existingProduct.permissions;

                    rawProductMetadataToCreateOrUpdate[rawProductKey] = mergeWith(existingProduct, rawProduct);
                }
            });
        })
        .then(() => {
            _.each(rawProductMetadataToCreateOrUpdate, (rawProduct) => {
                rawProduct.data.tileKeys = _.map(rawProduct.data.data.tiles, 'tile');
            });
        })
        .then(async () => {
            for (let productKey of Object.keys(rawProductMetadataToCreateOrUpdate)) {
                let rawProduct = rawProductMetadataToCreateOrUpdate[productKey];

                rawProduct.data.geometry = await getGeometryForS2TilesByKeys(rawProduct.data.tileKeys);
            }
        })
        .then(() => {
            return handler
                .update(
                    'specific',
                    {
                        user: request.user,
                        body: {
                            data: {
                                worldCerealProductMetadata: _.map(rawProductMetadataToCreateOrUpdate)
                            }
                        }
                    }
                )
                .then((update) => {
                    if (update.type !== result.UPDATED) {
                        throw new Error(JSON.stringify(update));
                    } else {
                        return update.data.data.worldCerealProductMetadata;
                    }
                })
        })
        .then(async (updatedProducts) => {
            for (let updatedProduct of updatedProducts) {
                if (updatedProduct.data.data.public && updatedProduct.data.data.public === "true") {
                    await setAsPublic(updatedProduct.key);
                } else {
                    await setAsPrivate(updatedProduct.key);
                }
            }
        })
        .then(() => {
            response.status(200).send(rawProductMetadataToCreateOrUpdate);
        })
        .catch((error) => {
            console.log(error);
            response.status(500).send({ error: error.message });
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

                        product.data.data.geometry = product.data.geometry;

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
    remove,
    view,
    getKeyByProductId
}