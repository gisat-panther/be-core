const uuidByString = require('uuid-by-string');
const _ = require('lodash');
const fs = require('fs');

const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');
const shared = require('../shared');
const db = require('../../../src/db');
const s2tiles = require('../s2tiles');
const mapserver = require('../../../src/modules/map/mapserver');
const mapproxy = require('../../../src/modules/map/mapproxy');

const config = require('../../../config');

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
    'properties.proj:epsg',
    'assets',
    'assets.product',
    'assets.product.href',
    'assets.metafeatures',
    'assets.metafeatures.href',
    'assets.confidence',
    'assets.confidence.href'
]

const STAC_REQUIRED_PROPERTIES_EXCEPTIONS = {
    'properties.mgrs:utm_zone': {
    },
    'properties.mgrs:latitude_band': {
    },
    'properties.mgrs:grid_square': {
    },
    'assets.metafeatures': {
    },
    'assets.metafeatures.href': {
    },
    'assets.confidence': {
        // "properties.product": "activecropland"
    },
    'assets.confidence.href': {
        // "properties.product": "activecropland"
    }
}

function getKeyByProductId(productMetadata) {
    return uuidByString(productMetadata.properties.tile_collection_id);
}

function setAsPublic(key) {
    return db
        .query(`SELECT "key" FROM "user"."permissions" WHERE "permission" = 'view' AND "resourceKey" = '${key}';`)
        .then((pgResult) => pgResult.rows[0].key)
        .then((permissionKey) => {
            return db
                .query(`INSERT INTO "user"."groupPermissions" ("groupKey", "permissionKey") VALUES ('${GROUPS.worldCerealPublic}', '${permissionKey}') ON CONFLICT DO NOTHING;`)
        })
}

function setAsPrivate(key) {
    return db
        .query(`SELECT "key" FROM "user"."permissions" WHERE "permission" = 'view' AND "resourceKey" = '${key}';`)
        .then((pgResult) => pgResult.rows[0].key)
        .then((permissionKey) => {
            return db
                .query(`DELETE FROM "user"."groupPermissions" WHERE "groupKey" = '${GROUPS.worldCerealPublic}' AND "permissionKey" = '${permissionKey}';`)
        })
}

function checkRequiredProperty(requiredPropertyPath, stac) {
    if (!_.has(stac, requiredPropertyPath)) {
        if (_.has(STAC_REQUIRED_PROPERTIES_EXCEPTIONS, requiredPropertyPath)) {
            for (let [path, value] of Object.entries(STAC_REQUIRED_PROPERTIES_EXCEPTIONS[requiredPropertyPath])) {
                if (_.get(stac, path) !== value) {
                    throw new Error(`Property ${requiredPropertyPath} in STAC ${stac.id} was not found!`);
                }
            }
        } else {
            throw new Error(`Property ${requiredPropertyPath} in STAC ${stac.id} was not found!`);
        }
    }
}

function checkRequiredProperties(stacList) {
    return Promise
        .resolve()
        .then(() => {
            _.each(stacList, (stac) => {
                _.each(STAC_REQUIRED_PROPERTIES, (requiredPropertyPath) => {
                    checkRequiredProperty(requiredPropertyPath, stac);
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
    let product = {
        key: getKeyByProductId(stac),
        data: {
            data: {
                tile_collection_id: stac.properties.tile_collection_id,
                sos: stac.properties.start_datetime,
                eos: stac.properties.end_datetime,
                season: stac.properties.season,
                aez_id: stac.properties.aez_id,
                aez_group: stac.properties.aez_group,
                model: stac.properties.model,
                training_refids: stac.properties.training_refids,
                product: stac.properties.product,
                public: stac.properties.public,
                geometry: stac.geometry
            }
        }
    };

    if (
        stac.properties.hasOwnProperty('mgrs:utm_zone')
        && stac.properties.hasOwnProperty('mgrs:latitude_band')
        && stac.properties.hasOwnProperty('mgrs:grid_square')
    ) {
        product.data.data.tiles = [
            {
                "id": stac.id,
                "tile": `${stac.properties["mgrs:utm_zone"]}${stac.properties["mgrs:latitude_band"]}${stac.properties["mgrs:grid_square"]}`,
                "product": stac.assets.product.href,
                "metafeatures": stac.assets.metafeatures && stac.assets.metafeatures.href,
                "confidence": stac.assets.confidence && stac.assets.confidence.href,
                "stac": _.find(stac.links, (link) => link.rel === "self").href,
                "src_epsg": stac.properties["proj:epsg"],
                "src_bbox": stac.bbox
            }
        ]
    } else {
        product.data.data.merged = {
            "id": stac.id,
            "product": stac.assets.product.href,
            "metafeatures": stac.assets.metafeatures && stac.assets.metafeatures.href,
            "confidence": stac.assets.confidence && stac.assets.confidence.href,
            "stac": _.find(stac.links, (link) => link.rel === "self").href,
            "src_epsg": stac.properties["proj:epsg"],
            "src_bbox": stac.bbox
        }
    }

    return product;
}

function getGeometryForS2TilesByKeys(s2TileKeys) {
    if (s2TileKeys) {
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

async function create(request, response) {
    let rawProductMetadataToCreateOrUpdate = {};
    let rawProductMetadataToCreate = {};
    let rawProductMetadataToUpdate = {};

    return Promise
        .resolve()
        .then(() => {
            return ensureArray(request.body);
        })
        .then((stacList) => {
            return checkRequiredProperties(stacList)
                .then(() => stacList);
        })
        .then((stacList) => {
            for (let stac of stacList) {
                let productMetadata = getProductMetadataFromStac(stac);
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

                    rawProductMetadataToUpdate[rawProductKey] = mergeWith(existingProduct, rawProduct);
                } else {
                    rawProductMetadataToCreate[rawProductKey] = rawProduct;
                }
            });
        })
        .then(() => {
            _.each(rawProductMetadataToCreate, (rawProduct) => {
                if (rawProduct.data.data.hasOwnProperty('tiles')) {
                    rawProduct.data.tileKeys = _.map(rawProduct.data.data.tiles, 'tile');
                } else {
                    rawProduct.data.tileKeys = null;
                }
            });
            _.each(rawProductMetadataToUpdate, (rawProduct) => {
                if (rawProduct.data.data.hasOwnProperty('tiles')) {
                    rawProduct.data.tileKeys = _.map(rawProduct.data.data.tiles, 'tile');
                } else {
                    rawProduct.data.tileKeys = null;
                }
            });
        })
        .then(async () => {
            for (let productKey of Object.keys(rawProductMetadataToCreate)) {
                let rawProduct = rawProductMetadataToCreate[productKey];

                rawProduct.data.geometry = await getGeometryForS2TilesByKeys(rawProduct.data.tileKeys) || rawProduct.data.data.geometry;
                delete rawProduct.data.data.geometry;
            }
            for (let productKey of Object.keys(rawProductMetadataToUpdate)) {
                let rawProduct = rawProductMetadataToUpdate[productKey];

                rawProduct.data.geometry = await getGeometryForS2TilesByKeys(rawProduct.data.tileKeys) || rawProduct.data.data.geometry;
                delete rawProduct.data.data.geometry;
            }
        })
        .then(async () => {
            const mapfiles = [];
            const mapproxyConfs = [];
            const dataSources = [];

            Object.entries(
                Object.assign(
                    {},
                    rawProductMetadataToCreate,
                    rawProductMetadataToUpdate
                )
            ).forEach(([key, object]) => {
                const productName = `wc_${object.data.data.tile_collection_id}`;
                const isPublic = object.data.data.public && object.data.data.public.toLowerCase() === "true";
                object.data.data.tiles.forEach((tile) => {
                    ["product", "metafeatures", "confidence"].forEach((type) => {
                        if (tile[type]) {
                            const name = `wc_${tile.id}_${type}`;
                            mapfiles.push({
                                filename: `${name}.map`,
                                sourceName: name,
                                productName,
                                epsg: tile.src_epsg,
                                bbox: tile.src_bbox,
                                definition: mapserver.getMapfileString({
                                    name: `${name}`,
                                    projection: `epsg:${tile.src_epsg}`,
                                    config: Object.entries(config.projects.worldCereal.s3),
                                    layers: [{
                                        name,
                                        status: true,
                                        type: "RASTER",
                                        projection: `epsg:${tile.src_epsg}`,
                                        data: `${tile[type].replace("s3:/", "/vsis3")}`
                                    }]
                                })
                            });
                        }
                    })
                });

                ["product", "metafeatures", "confidence"].forEach((type) => {
                    const sources = {};
                    const caches = {};

                    mapfiles
                        .filter((mapfile) => mapfile.productName = productName && mapfile.sourceName.endsWith(`_${type}`))
                        .forEach((mapfile) => {
                            sources[`${productName}_${mapfile.sourceName}`] = {
                                type: "mapserver",
                                req: {
                                    layers: `layer_${mapfile.sourceName}`,
                                    map: `${config.mapproxy.paths.confLocal || config.mapproxy.paths.conf}/${mapfile.filename}`,
                                    transparent: true
                                },
                                coverage: {
                                    bbox: mapfile.bbox,
                                    srs: `epsg:4326`
                                },
                                supported_srs: [`epsg:${mapfile.epsg}`]
                            }
                        });

                    caches[`wc_${object.data.data.tile_collection_id}_${type}`] = {
                        sources: Object.entries(sources).map(([sourceName]) => sourceName),
                        grids: ["GLOBAL_WEBMERCATOR"],
                        cache: {
                            type: "sqlite",
                            directory: `${(config.mapproxy.paths.cacheLocal || config.mapproxy.paths.cache)}/${productName}`,
                            tile_lock_dir: `${(config.mapproxy.paths.cacheLocal || config.mapproxy.paths.cache)}/${productName}/tile_lock`
                        }
                    }

                    mapproxyConfs.push({
                        filename: `wc_${object.data.data.tile_collection_id}_${type}.yaml`,
                        definition: mapproxy.getMapproxyYamlString({
                            services: {
                                demo: {},
                                wms: {
                                    srs: ["EPSG:4326", "EPSG:3857"],
                                    versions: ["1.1.1", "1.3.0"],
                                    image_formats: ['image/png', 'image/jpeg'],
                                    md: {

                                        online_resource: `${config.url}/proxy/wms`
                                    }
                                }
                            },
                            sources,
                            caches,
                            layers: [{
                                name: `wc_${object.data.data.tile_collection_id}_${type}`,
                                title: `wc_${object.data.data.tile_collection_id}_${type}`,
                                sources: [`wc_${object.data.data.tile_collection_id}_${type}`]
                            }]
                        })
                    });

                    const dataSourceKey = uuidByString(`wc_${object.data.data.tile_collection_id}_${type}`);
                    const downloadItems = {};

                    object.data.data.tiles.forEach((tile) => {
                        const itemKey = uuidByString(`${tile[type]}`);
                        downloadItems[itemKey] = `${tile[type]}`;
                        tile[type] = `${config.url}/download/${dataSourceKey}/${itemKey}`;

                        if (type === "product") {
                            const stacItemKey = uuidByString(`${tile.stac}`);
                            downloadItems[stacItemKey] = `${tile.stac}`;
                            tile.stac = `${config.url}/download/${dataSourceKey}/${stacItemKey}`;
                        }
                    });

                    dataSources.push({
                        key: dataSourceKey,
                        data: {
                            type: "wms",
                            url: `${config.url}/proxy/wms/${dataSourceKey}`,
                            layers: `wc_${object.data.data.tile_collection_id}_${type}`,
                            configuration: {
                                isPublic,
                                mapproxy: {
                                    instance: `wc_${object.data.data.tile_collection_id}_${type}`
                                },
                                download: {
                                    storageType: "s3",
                                    credentials: {
                                        source: "localConfig",
                                        path: "projects.worldCereal.s3"
                                    },
                                    items: downloadItems
                                }
                            }
                        }
                    })

                    object.data.data.dataSource = object.data.data.dataSource || {};
                    object.data.data.dataSource[type] = dataSourceKey;
                });
            });

            const promises = [];

            mapfiles.forEach((mapfile) => {
                promises.push(
                    Promise
                        .resolve()
                        .then(() => fs.writeFileSync(
                            `${config.mapproxy.paths.conf}/${mapfile.filename}`,
                            mapfile.definition
                        ))
                );
            });

            mapproxyConfs.forEach((mapproxyConf) => {
                promises.push(
                    Promise
                        .resolve()
                        .then(() => fs.writeFileSync(
                            `${config.mapproxy.paths.conf}/${mapproxyConf.filename}`,
                            mapproxyConf.definition
                        ))
                );
            });

            if (dataSources.length) {
                promises.push(
                    handler.update(
                        "dataSources",
                        {
                            user: request.user,
                            body: {
                                data: {
                                    spatial: dataSources
                                }
                            }
                        }
                    ).then((result) => {
                        return Promise.all(
                            result.data.data.spatial.map((dataSource) => {
                                if (dataSource.data.configuration.isPublic) {
                                    return setAsPublic(dataSource.key);
                                } else {
                                    return setAsPrivate(dataSource.key);
                                }
                            })
                        );
                    })
                );
            }

            return Promise.all(promises);
        })
        .then(() => {
            if (Object.keys(rawProductMetadataToCreate).length) {
                return handler
                    .create(
                        'specific',
                        {
                            user: request.user,
                            body: {
                                data: {
                                    worldCerealProductMetadata: _.map(rawProductMetadataToCreate)
                                }
                            }
                        }
                    )
                    .then((create) => {
                        if (create.type !== result.CREATED) {
                            throw new Error(JSON.stringify(create));
                        } else {
                            return create.data.data.worldCerealProductMetadata;
                        }
                    })
            }
        })
        .then(async (createdProducts) => {
            if (createdProducts) {
                for (let createdProduct of createdProducts) {
                    if (createdProduct.data.data.public && createdProduct.data.data.public.toLowerCase() === "true") {
                        await setAsPublic(createdProduct.key);
                    } else {
                        await setAsPrivate(createdProduct.key);
                    }
                }
            }
        })
        .then(() => {
            if (Object.keys(rawProductMetadataToUpdate).length) {
                return handler
                    .update(
                        'specific',
                        {
                            user: request.user,
                            body: {
                                data: {
                                    worldCerealProductMetadata: _.map(rawProductMetadataToUpdate)
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
            }
        })
        .then(async (updatedProducts) => {
            if (updatedProducts) {
                for (let updatedProduct of updatedProducts) {
                    if (updatedProduct.data.data.public && updatedProduct.data.data.public.toLowerCase() === "true") {
                        await setAsPublic(updatedProduct.key);
                    } else {
                        await setAsPrivate(updatedProduct.key);
                    }
                }
            }
        })
        .then(() => {
            response.status(200).send({ created: rawProductMetadataToCreate, updated: rawProductMetadataToUpdate });
        })
        .catch((error) => {
            console.log(error);
            response.status(500).send({ error: error.message });
        })
}

function remove(request, response) {
    let key;
    if (request.query.tile_collection_id) {
        key = getKeyByProductId({ properties: { tile_collection_id: request.query.tile_collection_id } });
    } else if (request.query.key) {
        key = request.query.key;
    }

    return handler
        .deleteRecords('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key
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
            if (request.body.geometry && !request.body.tiles) {
                tiles = await s2tiles.getTilesByGeometry(request.body.geometry);
            } else if (request.body.tiles) {
                tiles = request.body.tiles;
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
            }

            if (request.body.tilesKeys) {
                filter.tiles = {
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
                        filter,
                        limit: 999999
                    }
                })
        })
        .then(async (r) => {
            if (r.type === result.SUCCESS) {
                // TODO Temporary fix product cache, find better way how to handle this, there is probably need to identify session somehow
                // const sharedStorageKey = `${request.user.realKey}_products`;

                // let sentProductKeys = await shared.get(sharedStorageKey) || [];

                let products = r.data.data.worldCerealProductMetadata.map((product) => {
                    // if (!sentProductKeys.includes(product.key)) {
                    // sentProductKeys.push(product.key);

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
                    // } else {
                    //     return Object.assign(
                    //         {},
                    //         product,
                    //         {
                    //             data: undefined,
                    //             permissions: undefined
                    //         }
                    //     );
                    // }
                });

                // await shared.set(sharedStorageKey, sentProductKeys);

                response.status(200).send({
                    products,
                    tiles
                }

                );
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
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