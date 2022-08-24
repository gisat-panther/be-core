const uuidByString = require('uuid-by-string');
const _ = require('lodash');
const fsp = require('fs/promises');
const { execSync } = require('node:child_process');

const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');
const db = require('../../../src/db');
const mapserver = require('../../../src/modules/map/mapserver');
const mapproxy = require('../../../src/modules/map/mapproxy');
const queue = require('../queue');

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
        .query(`SELECT ST_AsGeoJSON(ST_ForcePolygonCCW(ST_ConvexHull(ST_Union("geometry")))) AS "geometry" FROM "worldCerealStacs" WHERE "productKey" = '${productKey}'`)
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

async function setMapproxySeeds(mapproxyConfs) {
    const caches = await db
        .query(
            `SELECT 
                CONCAT('wc_', stac#>>'{properties, tile_collection_id}') AS "name", 
                REPLACE(TRIM(trailing ')' FROM (TRIM(leading 'BOX(' FROM ST_Extent("geometry")::text))), ',', ' ') AS "coverage" 
            FROM "worldCerealStacs" GROUP BY "name";`
        ).then((result) => result.rows);

    const seeds = {};
    const coverages = {};
    caches.forEach((cache) => {
        seeds[cache.name] = {
            caches: [cache.name],
            grids: ["GLOBAL_WEBMERCATOR"],
            levels: {
                to: 10
            },
            coverages: [cache.name]
        };

        coverages[cache.name] = {
            bbox: cache.coverage.split(" ").map(Number),
            srs: `epsg:4326`
        }
    });

    const mapproxySeedYamlString = mapproxy.getMapproxySeedYamlString({ seeds, coverages });

    await storeMapproxySeedConf(mapproxySeedYamlString);
}

async function create(request, response) {
    const stacArray = ensureArray(request.body);
    const owner = request.user.realKey;

    await checkRequiredProperties(stacArray);

    for (const stac of stacArray) {
        await storeStacToLocalDb(stac, owner);
    }

    const baseProductKeys = getBaseProductKeys(stacArray, owner);

    for (const productKey of baseProductKeys) {
        await queue.set(productKey, "created", request.user);
    }

    response.status(200).end();
}

async function createQueued(productKey, user) {
    const productStacs = await getProductStacs(productKey);
    const productGeometry = await getProductGeometry(productKey);

    const baseProduct = getBaseProduct(productKey, productStacs, productGeometry);

    const mapTileIndexes = await getMapTileIndexes(baseProduct);

    const mapfile = getProductMapfile(baseProduct, mapTileIndexes);
    const mapproxyConf = getProductMapproxyConf(baseProduct, mapfile);
    const mapproxySeedConf = await getProductMapproxySeedConf(mapproxyConf);
    const dataSources = getProductDataSources(baseProduct);

    const finalProduct = getFinalProduct(baseProduct);

    const worldCerealProductMetadata = await ensureWorldCerealProductMetadata(finalProduct, user);

    await setProductAccessibility(worldCerealProductMetadata);

    await storeMapfile(mapfile);
    await storeMapproxyConf(mapproxyConf);
    await storeMapproxySeedConf(mapproxySeedConf);
    await storeDataSources(dataSources, user);

    await setDataSourcesAccessibility(dataSources);

    await cleanMapproxyCache(baseProduct);
}

async function getMapTileIndexes(baseProduct) {
    const tilePaths = {};
    const tileIndexes = {};

    for (const tile of baseProduct.data.data.tiles) {
        for (const type of productTypes) {
            if (tile[type]) {
                tilePaths[type] = tilePaths[type] || [];
                tilePaths[type] = tilePaths[type].concat(tile[type].replace("s3:/", "/vsis3"));
            }
        }
    }

    const productName = getProductName(baseProduct);

    for (const type of Object.keys(tilePaths)) {
        const optfilePath = `./${productName}_${type}.optfile`;
        const tileIndexFileName = `${productName}_${type}`;
        const tileIndexFilePath = `${config.mapproxy.paths.conf}/${tileIndexFileName}.shp`;

        await fsp.writeFile(optfilePath, tilePaths[type].join("\n"));

        try {
            execSync(
                `gdaltindex -t_srs EPSG:3857 -src_srs_name src_srs ${tileIndexFilePath} --optfile ${optfilePath}`,
                {
                    env: config.projects.worldCereal.s3,
                    stdio: 'ignore'
                }
            )
            tileIndexes[type] = {
                name: tileIndexFileName,
                path: tileIndexFilePath
            };
        } catch (e) {

        }

        await fsp.unlink(optfilePath);
    }

    return tileIndexes;
}

function getProductName(baseProduct) {
    return `WorldCereal_${baseProduct.data.data.tile_collection_id}`;
}

function getDataSourceKey(productName, productType) {
    return uuidByString(`${productName}_${productType}`);
}

async function cleanMapproxyCache(baseProduct) {
    const productName = getProductName(baseProduct);
    const cacheFolder = `${config.mapproxy.paths.cache}/${productName}`;
    try {
        await fsp.rm(`${cacheFolder}`, { recursive: true, force: true });
    } catch (e) {
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

async function storeMapfile(mapfile) {
    await fsp.writeFile(
        `${config.mapproxy.paths.conf}/${mapfile.filename}`,
        mapfile.definition
    )
}

async function storeMapproxyConf(mapproxyConf) {
    await fsp.writeFile(
        `${config.mapproxy.paths.conf}/${mapproxyConf.filename}`,
        mapproxyConf.definition
    )
}

async function storeMapproxySeedConf(mapproxySeedConf) {
    fsp.writeFile(
        `${config.mapproxy.paths.seed}/${mapproxySeedConf.filename}`,
        mapproxySeedConf.definition
    )
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
                layers: type,
                configuration: {
                    isPublic: baseProduct.data.data.public && baseProduct.data.data.public.toLowerCase() === "true",
                    mapproxy: {
                        instance: getProductName(baseProduct)
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

function getProductMapproxyConf(baseProduct, mapfile) {
    const productName = getProductName(baseProduct);

    const sources = {};
    const caches = {};
    const layers = [];

    mapfile.layers.forEach((layer) => {
        sources[`${layer.name}`] = {
            type: "mapserver",
            req: {
                layers: `${layer.name}`,
                map: `${config.mapproxy.paths.conf}/${mapfile.filename}`,
                transparent: true
            },
            coverage: {
                datasource: layer.tileindex,
                srs: `EPSG:3857`
            },
            supported_srs: [`EPSG:4326`, `EPSG:3857`]
        }

        caches[`cache_${layer.name}`] = {
            sources: [layer.name],
            grids: ["GLOBAL_GEODETIC", "GLOBAL_WEBMERCATOR"],
            image: {
                transparent: true,
                resampling_method: "nearest"
            },
            cache: {
                type: "sqlite",
                directory: `${config.mapproxy.paths.cache}/${productName}/${layer.name}`,
                tile_lock_dir: `${config.mapproxy.paths.cache}/${productName}/${layer.name}/tile_lock`
            }
        }

        layers.push({
            name: layer.name,
            title: layer.name,
            sources: [`cache_${layer.name}`]
        })
    });

    return {
        filename: `${productName}.yaml`,
        caches,
        sources,
        definition: mapproxy.getMapproxyYamlString({
            services: {
                demo: {},
                wms: {
                    srs: ["EPSG:4326", "EPSG:3857"],
                    versions: ["1.1.1", "1.3.0"],
                    image_formats: ['image/png', 'image/jpeg'],
                    md: {
                        title: productName,
                        online_resource: `${config.url}/proxy/wms`
                    }
                }
            },
            sources,
            caches,
            layers
        })
    }
}

async function getProductBbox(baseProduct) {
    return await db
        .query(
            `SELECT 
                REPLACE(TRIM(trailing ')' FROM (TRIM(leading 'BOX(' FROM ST_Extent("geometry")::text))), ',', ' ') AS "bbox" 
            FROM "worldCerealStacs" WHERE "productKey" = '${baseProduct.key}';`
        ).then((result) => result.rows[0].bbox);
}

async function getProductMapproxySeedConf(mapproxyConf) {
    const seeds = {};
    const coverages = {};

    for (const sourceName of Object.keys(mapproxyConf.sources)) {
        coverages[sourceName] = mapproxyConf.sources[sourceName].coverage;
        seeds[sourceName] = {
            caches: [`cache_${sourceName}`],
            coverages: [sourceName],
            grids: ["GLOBAL_GEODETIC", "GLOBAL_WEBMERCATOR"],
            levels: {
                to: 12
            }
        }
    }

    return {
        filename: mapproxyConf.filename,
        definition: mapproxy.getMapproxySeedYamlString({
            seeds,
            coverages
        })
    };
}

function getProductMapfile(baseProduct, mapTileIndexes) {
    const productName = getProductName(baseProduct);
    const layers = [];

    for (const type of Object.keys(mapTileIndexes)) {
        layers.push({
            name: type,
            tileindex: mapTileIndexes[type].path
        })
    }

    return {
        filename: `${productName}.map`,
        layers,
        definition: mapserver.getMapfileString({
            name: productName,
            units: "DD",
            web: {
                metadata: {
                    "wms_enable_request": "*",
                    "ows_enable_request": "*",
                    "wms_srs": "EPSG:4326 EPSG:3857"
                }
            },
            projection: ["init=EPSG:4326", "init=EPSG:3857"],
            config: config.projects.worldCereal.s3,
            layer: layers.map((layer) => {
                return {
                    name: `${layer.name}`,
                    status: "ON",
                    type: "RASTER",
                    projection: ["AUTO"],
                    offsite: [186, 186, 186],
                    tileindex: layer.tileindex,
                    tileitem: "location",
                    tilesrs: "src_srs"
                }
            })
        })
    };
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
        .catch(() => {
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
    createQueued,
    remove,
    view,
    getKeyByProductId
}