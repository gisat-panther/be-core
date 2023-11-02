const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { S3Client, ListObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const uuidByString = require('uuid-by-string');
const moment = require('moment');
const axios = require('axios');
const schedule = require('node-schedule');

const config = require('../../config');
const mapserver = require('../../src/modules/map/mapserver');
const mapproxy = require('../../src/modules/map/mapproxy');

const { SAMAS_WMS_ONLINERESOURCE: wmsOnlineresourceUrl } = process.env;

const s3Client = new S3Client({
    credentials: {
        accessKeyId: config.projects.samas.s3.accessKey,
        secretAccessKey: config.projects.samas.s3.accessSecret
    },
    endpoint: "https://" + config.projects.samas.s3.endpoint,
    forcePathStyle: true,
    region: config.projects.samas.s3.region
})

const products = {
    ndvi: {
        match: (filename) => filename.endsWith("_ndvi"),
        style: require('./styles/ndvi_spojity_v2.json'),
        time: (filename) => {
            const dateStr = filename.split("_")[0];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.previews
    },
    nir_pseudocolor: {
        match: (filename) => filename.endsWith("_nir_pseudocolor"),
        time: (filename) => {
            const dateStr = filename.split("_")[0];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.previews
    },
    true_color: {
        match: (filename) => filename.endsWith("_true_color"),
        time: (filename) => {
            const dateStr = filename.split("_")[0];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.previews
    },
    slb_hm: {
        match: (filename) => filename.startsWith("SLB_HM"),
        time: (filename) => {
            const dateStr = filename.split("_")[2];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.slb_hm
    },
    slb_multict_crop1: {
        match: (filename) => filename.startsWith("SLB_CT") && filename.includes("CROP1"),
        time: (filename) => {
            const dateStr = filename.split("_")[2];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.slb_multicrop
    },
    slb_multict_crop2: {
        match: (filename) => filename.startsWith("SLB_CT") && filename.includes("CROP2"),
        time: (filename) => {
            const dateStr = filename.split("_")[2];
            return moment.utc(dateStr).startOf('day');
        },
        config: config.projects.samas.products.slb_multicrop
    }
}

async function getS3Objects(prefix, objects = [], nextMarker) {
    const command = new ListObjectsCommand({ Bucket: config.projects.samas.s3.bucket, Prefix: prefix, Marker: nextMarker, MaxKeys: 100 });
    const response = await s3Client.send(command);

    process.stdout.write(".");

    for (const content of response.Contents) {
        objects.push(content);
    }

    if (response.NextMarker) {
        return getS3Objects(prefix, objects, response.NextMarker)
    } else {
        return objects;
    }
}

async function getNextObjectsLimited(objects, limit) {
    const sortedObjects = objects.sort((a, b) => {
        const aFilename = path.parse(a.Key).name;
        const bFilename = path.parse(b.Key).name;

        const aFilenameParts = aFilename.split("_");
        const bFilenameParts = bFilename.split("_");

        if (aFilenameParts[0] > bFilenameParts[0]) {
            return -1;
        } else if (aFilenameParts[0] < bFilenameParts[0]) {
            return 1;
        } else {
            return 0;
        }
    })

    const limitDate = moment().subtract(limit, 'days');
    return sortedObjects.filter((object) => {
        const filename = path.parse(object.Key).name;
        const [date, type] = filename.split("_");
        const fileDate = moment(date);

        return fileDate.isAfter(limitDate) || fileDate.isSame(limitDate);
    });
}

async function getCurrectObjects() {
    const statusFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-objects.json`;

    try {
        const objectsString = await fsp.readFile(statusFile);
        return JSON.parse(objectsString);
    } catch (e) {
        return {};
    }
}

async function saveObjects(objects) {
    const statusFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-objects.json`;

    try {
        await fsp.writeFile(statusFile, JSON.stringify(objects, null, 2));
    } catch (e) {
        console.log(e);
    }
}

async function getUpdatedS3Objects(nextObjects, currentObjects) {
    const updatedObjects = {}

    for (const nextObject of nextObjects) {
        const key = uuidByString(nextObject.Key);
        const lastModified = moment(nextObject.LastModified).format();
        if (
            !currentObjects[key]
            || currentObjects[key].Size != nextObject.Size
            || currentObjects[key].lastModified != lastModified
        ) {
            if (!currentObjects[key]) {
                console.log(`#SAMAS# Map service > ${nextObject.Key} has to be added`);
            } else {
                console.log(`#SAMAS# Map service > ${nextObject.Key} has to be updated`);
            }

            updatedObjects[key] = {
                ...nextObject,
                lastModified
            }
        }
    }

    return updatedObjects
}

async function createMapserverConfigurationFile(objects, updatedObjectKeys) {
    const indexes = {};
    const mapserverConf = {
        name: "SAMAS-MapService",
        units: "meters",
        web: {
            metadata: {
                "wms_enable_request": "*",
                "wms_srs": "EPSG:5514",
                "wms_title": "SAMAS-MapService"
            }
        },
        projection: ["init=EPSG:5514"],
        extent: [-951499.37, -1353292.51, -159365.31, -911053.67],
        config: {
            AWS_ACCESS_KEY_ID: config.projects.samas.s3.accessKey,
            AWS_SECRET_ACCESS_KEY: config.projects.samas.s3.accessSecret,
            AWS_REGION: config.projects.samas.s3.region,
            AWS_S3_ENDPOINT: config.projects.samas.s3.endpoint,
            AWS_VIRTUAL_HOSTING: "FALSE"
        },
        layer: []
    };

    const mapproxyConf = {
        services: {
            demo: {},
            wms: {
                srs: ["EPSG:5514"],
                bbox_srs: ["EPSG:5514"],
                image_formats: ["image/png", "image/jpeg", "image/tiff"],
                md: {}
            }
        },
        grids: {
            krovak: {
                srs: "EPSG:5514",
                bbox: [-951499.37, -1353292.51, -159365.31, -911053.67],
                bbox_srs: "EPSG:5514",
                origin: "nw"
            }
        },
        sources: {},
        caches: {},
        layers: []
    };

    const mapproxySeedConf = {
        coverages: {},
        seeds: {},
        cleanups: {}
    }

    if (wmsOnlineresourceUrl) {
        mapserverConf.web.metadata.wms_onlineresource = wmsOnlineresourceUrl
        mapproxyConf.services.wms.md.online_resource = wmsOnlineresourceUrl
    }

    for (const [key, object] of Object.entries(objects)) {
        for (const type of Object.keys(products)) {
            if (!products[type].config.enabled) continue;

            const filename = path.parse(object.Key).name;

            if (!indexes[type]) {
                indexes[type] = [];
            }

            if (products[type].match(filename)) {
                indexes[type].push(object);
            }
        }
    }

    for (const [type, typeIndexes] of Object.entries(indexes)) {
        if (!products[type].config.latestOnly) continue;

        let lastIndex;

        for (const typeIndex of typeIndexes) {
            if (!lastIndex || lastIndex.Key < typeIndex.Key) {
                lastIndex = typeIndex;
            }
        }

        indexes[type] = [lastIndex];
    }

    const reCacheTasks = [];
    const cachesToKeep = [];

    for (const type of Object.keys(products)) {
        if (!products[type].config.enabled) continue;

        const typeIndexes = indexes[type];

        if (!typeIndexes.length) continue;

        const tileIndexGeoJson = {
            type: "FeatureCollection",
            name: `SAMAS-TIME-${type}`,
            crs: {
                type: "name",
                properties: {
                    name: "EPSG:5514"
                }
            },
            features: []
        }

        const tileIndexGeoJSON = `${config.projects.samas.paths.mapproxyConf}/SAMAS-TIME-${type}.geojson`;

        let minTime, maxTime, minX, minY, maxX, maxY;
        let availableTimes = [];

        for (const object of typeIndexes) {
            let location, timeString, fid;

            if (object.localPath) {
                location = object.localPath;
            } else {
                location = `/vsis3/samas-mapservice/${object.Key}`;
            }

            const momentTime = products[type].time(path.parse(object.Key).name);

            if (!config.projects.samas.useLegacyFormat) {
                timeString = momentTime.format();
            } else {
                timeString = momentTime.format("YYYY-MM-DD");

                if (type.startsWith("slb_")) {
                    timeString = momentTime.format("YYYY-MM");
                }
            }

            fid = `${type}-${timeString.replace(/:|-/g, "")}`;

            availableTimes.push(
                {
                    time: timeString,
                    lastModified: moment.utc(object.lastModified).format("YYYY-MM-DDTHH:mm:ss"),
                    reCache: updatedObjectKeys.includes(object.Key)
                }
            );

            if (!minTime || moment(minTime).isAfter(momentTime)) {
                minTime = timeString;
            }

            if (!maxTime || moment(maxTime).isBefore(momentTime)) {
                maxTime = timeString;
            }

            const [x1, y1] = object.gdalInfo.cornerCoordinates.lowerLeft;
            const [x2, y2] = object.gdalInfo.cornerCoordinates.upperRight;

            if (minX === undefined || minX > x1) {
                minX = x1;
            }

            if (minY === undefined || minY > y1) {
                minY = y1;
            }

            if (maxX === undefined || maxX < x2) {
                maxX = x2;
            }

            if (maxY === undefined || maxY < y2) {
                maxY = y2;
            }

            const geom = {
                type: "Polygon",
                coordinates: [[
                    object.gdalInfo.cornerCoordinates.upperLeft,
                    object.gdalInfo.cornerCoordinates.lowerLeft,
                    object.gdalInfo.cornerCoordinates.lowerRight,
                    object.gdalInfo.cornerCoordinates.upperRight,
                    object.gdalInfo.cornerCoordinates.upperLeft,
                ]]
            }

            tileIndexGeoJson.features.push({
                type: "Feature",
                geometry: geom,
                properties: {
                    fid,
                    location,
                    acquired: timeString,
                    src_srs: object.srs
                }
            })
        }

        await fsp.writeFile(tileIndexGeoJSON, JSON.stringify(tileIndexGeoJson, null, 2));

        availableTimes = availableTimes.sort((a, b) => {
            if (a.time > b.time) {
                return 1;
            } else if (a.time < b.time) {
                return -1;
            } else {
                return 0;
            }
        });

        let wmsTimeExtent = availableTimes.map(({ time }) => time).join(",");
        if (config.projects.samas.useLegacyFormat && !type.startsWith("slb_")) {
            wmsTimeExtent = [`${minTime}/${maxTime}/P1D`];
        }

        mapserverConf.layer.push({
            name: `SAMAS-TIME-${type}-index`,
            units: "meters",
            status: "OFF",
            type: "POLYGON",
            connectiontype: "OGR",
            connection: path.parse(tileIndexGeoJSON).base,
            data: `SAMAS-TIME-${type}`,
            projection: ["init=EPSG:5514"],
            extent: [-951499.37, -1353292.51, -159365.31, -911053.67],
            class: {
                style: {
                    outlinecolor: [0, 0, 0]
                }
            },
            metadata: {
                wms_title: `SAMAS-TIME-${type}-index`,
                wms_srs: "EPSG:5514"
            }
        })

        mapserverConf.layer.push({
            name: `SAMAS-TIME-${type}`,
            units: "meters",
            status: "ON",
            type: "RASTER",
            tileindex: `SAMAS-TIME-${type}-index`,
            tileitem: "location",
            tilesrs: "src_srs",
            projection: ["init=EPSG:5514"],
            class: products[type].style,
            extent: [-951499.37, -1353292.51, -159365.31, -911053.67],
            metadata: {
                wms_title: `SAMAS-TIME-${type}`,
                wms_srs: "EPSG:5514",
                wms_timeitem: "acquired",
                wms_timeextent: wmsTimeExtent,
                wms_timedefault: maxTime
            }
        })

        for (const { time, lastModified, reCache } of availableTimes) {
            const formatedTime = time.replace(/:|-/g, "");
            mapproxyConf.sources[`source_SAMAS-TIME-${type}-${formatedTime}`] = {
                type: "wms",
                supported_srs: ["EPSG:5514"],
                forward_req_params: ["TIME"],
                seed_only: false,
                req: {
                    url: config.projects.samas.paths.mapserverUrl,
                    layers: `SAMAS-TIME-${type}`,
                    map: `${config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.map`,
                    transparent: true,
                    time
                },
            }

            mapproxyConf.caches[`cache_SAMAS-TIME-${type}-${formatedTime}`] = {
                format: "mixed",
                request_format: "image/png",
                grids: ["krovak"],
                sources: [`source_SAMAS-TIME-${type}-${formatedTime}`],
                link_single_color_images: true,
                use_direct_from_level: 8,
                image: {
                    transparent: true,
                    encoding_options: {
                        jpeg_quality: 50,
                        quantizer: "fastoctree"
                    }
                },
                cache: {
                    type: "file",
                    directory_layout: "tms",
                    directory: `${config.projects.samas.paths.mapproxyCache}/SAMAS-MapService/cache_SAMAS-TIME-${type}/krovak/time-${time}`
                }
            }

            cachesToKeep.push(`${config.projects.samas.paths.mapproxyCache}/SAMAS-MapService/cache_SAMAS-TIME-${type}/krovak/time-${time}`);

            mapproxySeedConf.coverages[`${type}-${formatedTime}`] = {
                datasource: tileIndexGeoJSON,
                where: `fid = '${type}-${formatedTime}'`,
                srs: "EPSG:5514"
            }

            mapproxySeedConf.seeds[`SAMAS-TIME-${type}-${formatedTime}`] = {
                coverages: [`${type}-${formatedTime}`],
                caches: [`cache_SAMAS-TIME-${type}-${formatedTime}`],
                grids: ["krovak"],
                refresh_before: {
                    time: lastModified
                },
                levels: {
                    to: 8
                }
            }

            mapproxySeedConf.cleanups[`SAMAS-TIME-${type}-${formatedTime}`] = {
                caches: [`cache_SAMAS-TIME-${type}-${formatedTime}`],
                grids: ["krovak"],
                remove_before: {
                    time: lastModified
                }
            }

            if (reCache) {
                reCacheTasks.push({
                    time,
                    seed: `seed/SAMAS-MapService.yaml/SAMAS-MapService.seed.yaml/SAMAS-TIME-${type}-${formatedTime}`,
                    cleanup: `cleanup/SAMAS-MapService.yaml/SAMAS-MapService.seed.yaml/SAMAS-TIME-${type}-${formatedTime}`
                });
            }
        }

        mapproxyConf.sources[`source_SAMAS-TIME-${type}`] = {
            type: "wms",
            supported_srs: ["EPSG:5514"],
            forward_req_params: ["TIME"],
            seed_only: false,
            req: {
                url: config.projects.samas.paths.mapserverUrl,
                layers: `SAMAS-TIME-${type}`,
                map: `${config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.map`,
                transparent: true
            },
        }

        mapproxyConf.caches[`cache_SAMAS-TIME-${type}`] = {
            format: "mixed",
            request_format: "image/png",
            grids: ["krovak"],
            sources: [`source_SAMAS-TIME-${type}`],
            link_single_color_images: true,
            use_direct_from_level: 8,
            image: {
                transparent: true,
                encoding_options: {
                    jpeg_quality: 50,
                    quantizer: "fastoctree"
                }
            },
            cache: {
                type: "file",
                directory_layout: "tms",
                directory: `${config.projects.samas.paths.mapproxyCache}/SAMAS-MapService/cache_SAMAS-TIME-${type}/krovak/`
            }
        }

        mapproxyConf.layers.push({
            name: `SAMAS-TIME-${type}`,
            title: `SAMAS-TIME-${type}`,
            sources: [`cache_SAMAS-TIME-${type}`],
            dimensions: {
                time: {
                    values: availableTimes.map(({ time }) => time),
                    default: maxTime
                }
            }
        })
    }

    const mapFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.map`;
    const mapproxyConfFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.yaml`;
    const mapproxySeedConfFile = `${config.projects.samas.paths.mapproxySeed || config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.seed.yaml`;

    await fsp.writeFile(mapFile, mapserver.getMapfileString(mapserverConf));
    await fsp.writeFile(mapproxyConfFile, mapproxy.getMapproxyYamlString(mapproxyConf));
    await fsp.writeFile(mapproxySeedConfFile, mapproxy.getMapproxySeedYamlString(mapproxySeedConf));

    if (cachesToKeep.length) {
        await clearUnusedCaches(cachesToKeep);
    }

    if (reCacheTasks.length) {
        await addReCacheTasksToQueue(reCacheTasks);
    }
}

async function clearUnusedCaches(cachesToKeep) {
    const baseFolders = [];
    const protected = ["single_color_tiles", "tile_locks"];
    for (const cacheToKeepPath of cachesToKeep) {
        const baseFolder = cacheToKeepPath.split(path.sep).slice(0, -1).join(path.sep);
        if (!baseFolders.includes(baseFolder)) {
            baseFolders.push(baseFolder);
        }
    }

    for (const baseFolder of baseFolders) {
        const baseFolderContent = fs.readdirSync(baseFolder, { withFileTypes: true });
        for (const dirent of baseFolderContent) {
            const contentPath = `${dirent.path}/${dirent.name}`;
            if (dirent.isDirectory && !protected.includes(dirent.name) && !cachesToKeep.includes(contentPath)) {
                try {
                    fs.rmSync(contentPath, {force: true, recursive: true});
                    console.log(`#SAMAS# Map service > ${contentPath} was removed.`);
                } catch(e) {
                    console.log(`#SAMAS# Map service > Failed to remove ${contentPath}.`);
                }
            }
        }
    }
}

async function addReCacheTasksToQueue(reCacheTasks) {
    if (!config.projects.samas.paths.mapproxySeedApi) return;

    reCacheTasks.sort((a, b) => {
        if (a.time < b.time) {
            return 1;
        } else if (a.time > b.time) {
            return -1;
        } else {
            return 0
        }
    });

    for (const task of reCacheTasks) {
        await axios.get(`${config.projects.samas.paths.mapproxySeedApi}/${task.seed}`).catch((error) => { });
        console.log(`#SAMAS# Map service > MapProxy api called -> ${task.seed}`);

        await axios.get(`${config.projects.samas.paths.mapproxySeedApi}/${task.cleanup}`).catch((error) => { });
        console.log(`#SAMAS# Map service > MapProxy api called -> ${task.cleanup}`);
    }
}

function getGdalInfo({ key, path }) {
    try {
        let output;

        if (key) {
            output = execSync(
                `gdalinfo -json /vsis3/samas-mapservice/${key}`,
                {
                    env: {
                        AWS_ACCESS_KEY_ID: config.projects.samas.s3.accessKey,
                        AWS_SECRET_ACCESS_KEY: config.projects.samas.s3.accessSecret,
                        AWS_REGION: config.projects.samas.s3.region,
                        AWS_S3_ENDPOINT: config.projects.samas.s3.endpoint,
                        AWS_VIRTUAL_HOSTING: "FALSE"
                    }
                }
            );
        } else if (path) {
            output = execSync(
                `gdalinfo -json ${path}`,
            );
        }

        if (output) return JSON.parse(output);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

async function getSrs({ key, path }) {
    try {
        let output;

        if (key) {
            output = execSync(
                `gdalsrsinfo -o epsg --single-line /vsis3/samas-mapservice/${key}`,
                {
                    env: {
                        AWS_ACCESS_KEY_ID: config.projects.samas.s3.accessKey,
                        AWS_SECRET_ACCESS_KEY: config.projects.samas.s3.accessSecret,
                        AWS_REGION: config.projects.samas.s3.region,
                        AWS_S3_ENDPOINT: config.projects.samas.s3.endpoint,
                        AWS_VIRTUAL_HOSTING: "FALSE"
                    }
                }
            );
        } else if (path) {
            output = execSync(
                `gdalsrsinfo -o epsg --single-line ${path}`
            );
        }

        if (output) return output.toString().trim();
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

async function saveUpdatedObjects(updatedObjects, currentObjects) {
    const objectsToSave = {
        ...currentObjects
    };

    for (const [key, object] of Object.entries(updatedObjects)) {
        let srs, gdalInfo;

        if (object.localPath) {
            srs = await getSrs({ path: object.localPath });
            gdalInfo = await getGdalInfo({ path: object.localPath });
        } else {
            srs = await getSrs({ key: object.Key });
            gdalInfo = await getGdalInfo({ key: object.Key });
        }

        const extendedObject = {
            ...object,
            srs,
            gdalInfo
        }

        if (objectsToSave[key]) {
            objectsToSave[key] = {
                ...objectsToSave[key],
                ...extendedObject
            }
        } else {
            objectsToSave[key] = {
                ...extendedObject
            }
        }

        console.log(`#SAMAS# Map service > GDALInfo obtained for ${key}, ${object.Key}`);
    }

    await saveObjects(objectsToSave);
}

async function runPreviews() {
    process.stdout.write(`#SAMAS# Map service > Checking previews`);

    const nextObjects = await getS3Objects(config.projects.samas.products.previews.prefix);

    process.stdout.write("Done!\n\r");

    const currentObjects = await getCurrectObjects();

    let nextObjectsLimited, updatedObjects;
    if (config.projects.samas.products.previews.limit && config.projects.samas.products.previews.limit != -1) {
        nextObjectsLimited = await getNextObjectsLimited(nextObjects, config.projects.samas.products.previews.limit || 3);
    }

    if (config.projects.samas.products.previews.localStorage) {
        updatedObjects = await saveObjectsToLocalStorage(
            await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects)
        );
    } else {
        updatedObjects = await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects);
    }

    if (Object.keys(updatedObjects).length) {
        await saveUpdatedObjects(updatedObjects, currentObjects);
        return Object.entries(updatedObjects).map(([key, object]) => object.Key);
    } else {
        return [];
    }
}

async function saveObjectsToLocalStorage(objects) {
    for (const [key, object] of Object.entries(objects)) {
        object.localPath = `${config.projects.samas.paths.localStorage}/${object.Key}`;

        const getObjectCommand = new GetObjectCommand({
            Bucket: config.projects.samas.s3.bucket,
            Key: object.Key
        })

        await fsp.mkdir(path.parse(object.localPath).dir, { recursive: true });

        const response = await s3Client.send(getObjectCommand);
        await fsp.writeFile(object.localPath, response.Body);

        console.log(`#SAMAS# Map service > ${object.Key} has been saved to local storage.`);
    }

    return objects;
}

async function runSlbHm() {
    process.stdout.write(`#SAMAS# Map service > Checking slb_hm`);

    const nextObjects = await getS3Objects(config.projects.samas.products.slb_hm.prefix);

    process.stdout.write("Done!\n\r");

    const currentObjects = await getCurrectObjects();

    let nextObjectsLimited, updatedObjects;
    if (config.projects.samas.products.slb_hm.limit && config.projects.samas.products.slb_hm.limit != -1) {
        nextObjectsLimited = await getNextObjectsLimited(nextObjects, config.projects.samas.products.slb_hm.limit || 3);
    }

    if (config.projects.samas.products.slb_hm.localStorage) {
        updatedObjects = await saveObjectsToLocalStorage(
            await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects)
        );
    } else {
        updatedObjects = await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects);
    }

    if (Object.keys(updatedObjects).length) {
        await saveUpdatedObjects(updatedObjects, currentObjects);
        return Object.entries(updatedObjects).map(([key, object]) => object.Key);
    } else {
        return [];
    }
}

async function runSlbMulticrop() {
    process.stdout.write(`#SAMAS# Map service > Checking slb_multicrops`);

    const nextObjects = await getS3Objects(config.projects.samas.products.slb_multicrop.prefix);

    process.stdout.write("Done!\n\r");

    const currentObjects = await getCurrectObjects();

    let nextObjectsLimited, updatedObjects;
    if (config.projects.samas.products.slb_multicrop.limit && config.projects.samas.products.slb_multicrop.limit != -1) {
        nextObjectsLimited = await getNextObjectsLimited(nextObjects, config.projects.samas.products.slb_multicrop.limit || 3);
    }

    if (config.projects.samas.products.slb_multicrop.localStorage) {
        updatedObjects = await saveObjectsToLocalStorage(
            await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects)
        );
    } else {
        updatedObjects = await getUpdatedS3Objects(nextObjectsLimited || nextObjects, currentObjects);
    }

    if (Object.keys(updatedObjects).length) {
        await saveUpdatedObjects(updatedObjects, currentObjects);
        return Object.entries(updatedObjects).map(([key, object]) => object.Key);
    } else {
        return [];
    }
}

async function checkDataAccessibility(objects) {
    process.stdout.write(`#SAMAS# Map service > Checking availibility of s3 objects`);

    for (const [key, object] of Object.entries(objects)) {
        const gdalInfo = await getGdalInfo(object.Key);
        process.stdout.write(".");
        if (!gdalInfo.bands) {
            console.log(object);
            process.exit(1);
        }
    }

    process.stdout.write("Done!\n\r");
}

async function run() {
    let updatedObjectKeys = [];

    if (config.projects.samas.products.previews.enabled) {
        updatedObjectKeys = updatedObjectKeys.concat(await runPreviews());
    }

    if (config.projects.samas.products.slb_hm.enabled) {
        updatedObjectKeys = updatedObjectKeys.concat(await runSlbHm());
    }

    if (config.projects.samas.products.slb_multicrop.enabled) {
        updatedObjectKeys = updatedObjectKeys.concat(await runSlbMulticrop());
    }

    // await checkDataAccessibility(await getCurrectObjects());

    if (updatedObjectKeys.length) {
        console.log(`#SAMAS# Map service > ${updatedObjectKeys.length} products were updated. Recreating mapserver configuration files.`)
        await createMapserverConfigurationFile(await getCurrectObjects(), updatedObjectKeys);
    }
}

async function init() {
    console.log(`#SAMAS# Map service > Scheduler set to "${config.projects.samas.schedule || "0 0 * * * *"}".`);

    let running = false;
    schedule.scheduleJob(config.projects.samas.schedule || "0 0 * * * *", () => {
        if (running) return;

        console.log(`#SAMAS# Map service > Checking for new products.`);

        running = true;
        run()
            .catch((error) => {
                console.log(error);
                console.log(`#SAMAS# Map service > Checking for new products failed!`);
            })
            .finally(() => {
                console.log(`#SAMAS# Map service > Checking for new products is done!`)
                running = false;
            });
    })
}

init();