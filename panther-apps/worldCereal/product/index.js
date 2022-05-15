const uuidByString = require('uuid-by-string');
const _ = require('lodash');
const fsp = require('fs/promises');

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

const productTypes = ["product", "metafeatures", "confidence"];

function getMapserverStylesByProduct(productId) {
    if (productId.includes("annualcropland_classification")) {
        return [
            {
                expression: "[pixel] = 100",
                color: "#e41a1c",
                name: "Annual cropland"
            }
        ]
    } else if (productId.includes("activecropland_classification")) {
        return [
            {
                expression: "[pixel] = 0",
                color: "#a8a8a8",
                name: "Non-active cropland"
            },
            {
                expression: "[pixel] = 100",
                color: "#2ca52a",
                name: "Active cropland"
            }
        ]
    } else if (productId.includes("irrigation_classification")) {
        return [
            {
                expression: "[pixel] = 0",
                color: "#a8a8a8",
                name: "Non-irrigated"
            },
            {
                expression: "[pixel] = 100",
                color: "#0065ea",
                name: "Irrigated"
            }
        ];
    } else if (productId.includes("maize_classification")) {
        return [
            {
                expression: "[pixel] = 0",
                color: "#a8a8a8",
                name: "Other crop"
            },
            {
                expression: "[pixel] = 100",
                color: "#e0cd00",
                name: "Maize"
            }
        ]
    } else if (productId.includes("springcereals_classification")) {
        return [
            {
                expression: "[pixel] = 0",
                color: "#a8a8a8",
                name: "Other crop"
            },
            {
                expression: "[pixel] = 100",
                color: "#ae3aba",
                name: "Cereals"
            }
        ];
    } else {
        return [];
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

function getProductKey(stac, owner) {
    return uuidByString(`${stac.properties.tile_collection_id}_${owner}`);
}

async function storeStacToLocalDb(stac, owner) {
    const key = uuidByString(`${stac.id}_${owner}`);
    const productKey = getProductKey(stac, owner);
    const geometry = JSON.stringify(stac.geometry);
    const tile = `${stac.properties["mgrs:utm_zone"]}${stac.properties["mgrs:latitude_band"]}${stac.properties["mgrs:grid_square"]}`;
    const stacStr = JSON.stringify(stac);

    await db.query(
        `INSERT INTO "worldCerealStacs" 
            (
                "key", 
                "productKey", 
                "geometry", 
                "tile", 
                "stac",
                "owner" 
            )
        VALUES
            (
                '${key}', 
                '${productKey}', 
                ST_GeomFromGeoJSON('${geometry}'), 
                '${tile}', 
                '${stacStr}',
                '${owner}'
            )
        ON CONFLICT ("key") DO UPDATE SET
            "productKey" = '${productKey}', 
            "geometry" = ST_GeomFromGeoJSON('${geometry}'), 
            "tile" = '${tile}', 
            "stac" = '${stacStr}';`
    );
}

async function getProductStacs(productKey) {
    return db
        .query(`SELECT "stac" FROM "worldCerealStacs" WHERE "productKey" = '${productKey}'`)
        .then((result) => result.rows.map((row) => row.stac));
}

async function getProductGeometry(productKey) {
    return db
        .query(`SELECT ST_AsGeoJSON(ST_ForcePolygonCCW(ST_ExteriorRing((ST_Dump(ST_Union("geometry"))).geom) )) AS "geometry" FROM "worldCerealStacs" WHERE "productKey" = '${productKey}'`)
        .then((result) => JSON.parse(result.rows[0].geometry));
}

function getBaseProduct(key, productStacs, productGeometry) {
    const tiles = productStacs.map((productStac) => {
        return {
            "id": productStac.id,
            "tile": `${productStac.properties["mgrs:utm_zone"]}${productStac.properties["mgrs:latitude_band"]}${productStac.properties["mgrs:grid_square"]}`,
            "product": productStac.assets.product.href,
            "metafeatures": productStac.assets.metafeatures && productStac.assets.metafeatures.href,
            "confidence": productStac.assets.confidence && productStac.assets.confidence.href,
            "stac": _.find(productStac.links, (link) => link.rel === "self").href,
            "src_epsg": productStac.properties["proj:epsg"],
            "src_bbox": productStac.bbox
        }
    });

    return {
        key,
        data: {
            tileKeys: tiles.map((tile) => tile.tile),
            geometry: productGeometry,
            data: {
                tile_collection_id: productStacs[0].properties.tile_collection_id,
                sos: productStacs[0].properties.start_datetime,
                eos: productStacs[0].properties.end_datetime,
                season: productStacs[0].properties.season,
                aez_id: productStacs[0].properties.aez_id,
                aez_group: productStacs[0].properties.aez_group,
                model: productStacs[0].properties.model,
                training_refids: productStacs[0].properties.training_refids,
                product: productStacs[0].properties.product,
                public: productStacs[0].properties.public,
                geometry: productGeometry,
                tiles,
                dataSource: {
                    product: null,
                    metafeatures: null,
                    confidence: null
                }
            }
        }
    };
}

async function ensureWorldCerealProductMetadata(product, requestUser) {
    return handler
        .update(
            'specific',
            {
                user: requestUser,
                body: {
                    data: {
                        worldCerealProductMetadata: [product]
                    }
                }
            }
        )
        .then((update) => {
            if (update.type !== result.UPDATED) {
                throw new Error(JSON.stringify(update));
            } else {
                return update.data.data.worldCerealProductMetadata[0];
            }
        })
}

async function create(request, response) {
    const stacArray = ensureArray(request.body);
    const owner = request.user.realKey;

    await checkRequiredProperties(stacArray);

    for (const stac of stacArray) {
        await storeStacToLocalDb(stac, owner);
    }

    const baseProductKeys = getBaseProductKeys(stacArray, owner);
    const worldCerealProductMetadataList = [];

    for (const baseProductKey of baseProductKeys) {
        const productStacs = await getProductStacs(baseProductKey);
        const productGeometry = await getProductGeometry(baseProductKey);

        const baseProduct = getBaseProduct(baseProductKey, productStacs, productGeometry);

        const mapfiles = getProductMapfiles(baseProduct);
        const mapproxyConfs = getProductMapproxyConfs(baseProduct, mapfiles);
        const dataSources = getProductDataSources(baseProduct);

        const finalProduct = getFinalProduct(baseProduct);

        const worldCerealProductMetadata = await ensureWorldCerealProductMetadata(finalProduct, request.user);

        await setProductAccessibility(worldCerealProductMetadata);

        await storeMapfiles(mapfiles);
        await storeMapproxyConfs(mapproxyConfs);
        await storeDataSources(dataSources, request.user);

        await setDataSourcesAccessibility(dataSources);

        await cleanMapproxyCache(baseProduct, mapproxyConfs);

        worldCerealProductMetadataList.push(worldCerealProductMetadata);
    }

    response.send(worldCerealProductMetadataList);
}

function getProductName(baseProduct) {
    return `wc_${baseProduct.data.data.tile_collection_id}`;
}

function getDataSourceKey(productName, productType) {
    return uuidByString(`${productName}_${productType}`);
}

async function cleanMapproxyCache(baseProduct, mapproxyConfs) {
    for (const mapproxyConf of mapproxyConfs) {
        for (const cacheConfKey of Object.keys(mapproxyConf.caches)) {
            const cacheFolder = `${config.mapproxy.paths.cache}/${cacheConfKey}`;

            try {
                const isMapproxyCache = (await fsp.lstat(`${cacheFolder}/tile_lock`)).isDirectory();
                if (isMapproxyCache) {
                    await fsp.rm(`${cacheFolder}`, {recursive: true, force: true});
                }
            } catch (error) {
                // console.log(error);
            }
        }
    }
}

async function storeDataSources(dataSources, requestUser) {
    await handler.update(
        "dataSources",
        {
            user: requestUser,
            body: {
                data: {
                    spatial: dataSources
                }
            }
        }
    );
}

async function storeMapfiles(mapfiles) {
    for (const mapfile of mapfiles) {
        await fsp.writeFile(
            `${config.mapproxy.paths.conf}/${mapfile.filename}`,
            mapfile.definition
        )
    }
}

async function storeMapproxyConfs(mapproxyConfs) {
    for (const mapproxyConf of mapproxyConfs) {
        fsp.writeFile(
            `${config.mapproxy.paths.conf}/${mapproxyConf.filename}`,
            mapproxyConf.definition
        )
    }
}

async function setProductAccessibility(product) {
    if (product.data.data.public && product.data.data.public.toLowerCase() === "true") {
        await setAsPublic(product.key);
    } else {
        await setAsPrivate(product.key);
    }
}

async function setDataSourcesAccessibility(dataSourcs) {
    for (const dataSource of dataSourcs) {
        if (dataSource.data.configuration.isPublic) {
            await setAsPublic(dataSource.key);
        } else {
            await setAsPrivate(dataSource.key);
        }
    }
}

function getFinalProduct(baseProduct) {
    const finalProduct = {
        ...baseProduct
    };

    productTypes.forEach((type) => {
        finalProduct.data.data.dataSource[type] = getDataSourceKey(getProductName(baseProduct), type);
    })

    finalProduct.data.data.tiles.forEach((tile) => {
        tile.product = `${config.url}/download/${finalProduct.data.data.dataSource.product}/${getDownloadItemKey(tile.product)}`;
        tile.metafeatures = `${config.url}/download/${finalProduct.data.data.dataSource.product}/${getDownloadItemKey(tile.metafeatures)}`;
        tile.confidence = `${config.url}/download/${finalProduct.data.data.dataSource.product}/${getDownloadItemKey(tile.confidence)}`;
        tile.stac = `${config.url}/download/${finalProduct.data.data.dataSource.product}/${getDownloadItemKey(tile.stac)}`;
    })

    return finalProduct;
}

function getDownloadItemKey(source) {
    return uuidByString(`${source}`);
}

function getProductDataSources(baseProduct) {
    const dataSources = [];
    const downloadItems = {};

    productTypes.forEach((type) => {
        baseProduct.data.data.tiles.forEach((tile) => {
            downloadItems[getDownloadItemKey(tile[type])] = `${tile[type]}`;

            if (type === "product") {
                downloadItems[getDownloadItemKey(tile.stac)] = `${tile.stac}`;
            }
        });

        dataSources.push({
            key: getDataSourceKey(getProductName(baseProduct), type),
            data: {
                type: "wms",
                url: `${config.url}/proxy/wms/${getDataSourceKey(getProductName(baseProduct), type)}`,
                layers: `${getProductName(baseProduct)}_${type}`,
                configuration: {
                    isPublic: baseProduct.data.data.public && baseProduct.data.data.public.toLowerCase() === "true",
                    mapproxy: {
                        instance: `${getProductName(baseProduct)}_${type}`
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
    })

    return dataSources;
}

function getProductMapproxyConfs(baseProduct, mapfiles) {
    const mapproxyConfs = [];
    productTypes.forEach((type) => {
        const sources = {};
        const caches = {};

        mapfiles
            .filter((mapfile) => mapfile.productName === getProductName(baseProduct) && mapfile.sourceName.endsWith(`_${type}`))
            .forEach((mapfile) => {
                sources[`${getProductName(baseProduct)}_${mapfile.sourceName}`] = {
                    type: "mapserver",
                    req: {
                        layers: `${mapfile.sourceName}`,
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

        caches[`${getProductName(baseProduct)}_${type}`] = {
            sources: Object.entries(sources).map(([sourceName]) => sourceName),
            grids: ["GLOBAL_WEBMERCATOR"],
            image: {
                transparent: true,
                resampling_method: "nearest",
                colors: 0,
                mode: "RGBA"
            },
            cache: {
                type: "sqlite",
                directory: `${(config.mapproxy.paths.cacheLocal || config.mapproxy.paths.cache)}/${getProductName(baseProduct)}_${type}`,
                tile_lock_dir: `${(config.mapproxy.paths.cacheLocal || config.mapproxy.paths.cache)}/${getProductName(baseProduct)}_${type}/tile_lock`
            }
        }

        mapproxyConfs.push({
            filename: `${getProductName(baseProduct)}_${type}.yaml`,
            caches,
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
                    name: `${getProductName(baseProduct)}_${type}`,
                    title: `${getProductName(baseProduct)}_${type}`,
                    sources: [`${getProductName(baseProduct)}_${type}`]
                }]
            })
        });
    });

    return mapproxyConfs;
}

function getProductMapfiles(baseProduct) {
    const mapfiles = [];

    baseProduct.data.data.tiles.forEach((tile) => {
        productTypes.forEach((type) => {
            if (tile[type]) {
                const name = `wc_${tile.id}_${type}`;
                mapfiles.push({
                    filename: `${name}.map`,
                    sourceName: name,
                    productName: getProductName(baseProduct),
                    epsg: tile.src_epsg,
                    bbox: tile.src_bbox,
                    definition: mapserver.getMapfileString({
                        name: `map_${name}`,
                        projection: `epsg:${tile.src_epsg}`,
                        config: Object.entries(config.projects.worldCereal.s3),
                        layers: [{
                            name,
                            status: true,
                            type: "RASTER",
                            projection: `epsg:${tile.src_epsg}`,
                            data: `${tile[type].replace("s3:/", "/vsis3")}`,
                            styles: getMapserverStylesByProduct(tile.id)
                        }]
                    })
                });
            }
        })
    })

    return mapfiles;
}

function getBaseProductKeys(stacArray, owner) {
    const baseProductKeys = stacArray.map((stac) => {
        return getProductKey(stac, owner);
    });

    return Array.from(new Set(baseProductKeys));
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
    return Promise
        .resolve()
        .then(() => {
            let filter = {};

            if (request.body.geometry) {
                filter.geometry = {
                    geometry_overlaps: request.body.geometry
                }
            }

            if (request.body.tiles) {
                filter.tiles = {
                    overlaps: request.body.tiles
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
                let tiles = [];
                let products = r.data.data.worldCerealProductMetadata.map((product) => {
                    product.data.data.geometry = product.data.geometry;

                    tiles = tiles.concat(product.data.tileKeys);

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
                });

                response.status(200).send({
                    products,
                    tiles: Array.from(new Set(tiles))
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