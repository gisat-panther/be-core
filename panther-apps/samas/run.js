const fsp = require('node:fs/promises');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { S3Client, ListObjectsCommand } = require('@aws-sdk/client-s3');
const uuidByString = require('uuid-by-string');
const moment = require('moment');
const chp = require('child_process');

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

const types = ["ndvi", "nir_pseudocolor", "true_color"];
const styles = {
    ndvi: require('./styles/ndvi_spojity_v2.json')
}

async function getS3Objects(objects = [], nextMarker) {
    const command = new ListObjectsCommand({ Bucket: config.projects.samas.s3.bucket, Prefix: config.projects.samas.s3.prefix, Marker: nextMarker });
    const response = await s3Client.send(command);

    for (const content of response.Contents) {
        objects.push(content);
    }

    if (response.NextMarker) {
        return getS3Objects(objects, response.NextMarker)
    } else {
        return objects;
    }
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

async function createMapserverConfigurationFile(objects) {
    const indexes = {};
    const mapserverConf = {
        name: "SAMAS-MapService",
        units: "DD",
        web: {
            metadata: {
                "wms_enable_request": "*",
                "wms_srs": "EPSG:5514",
                "wms_title": "SAMAS-MapService"
            }
        },
        projection: ["init=EPSG:5514"],
        config: {
            AWS_ACCESS_KEY_ID: config.projects.samas.s3.accessKey,
            AWS_SECRET_ACCESS_KEY: config.projects.samas.s3.accessSecret,
            AWS_REGION: config.projects.samas.s3.region,
            AWS_S3_ENDPOINT: config.projects.samas.s3.endpoint,
            AWS_VIRTUAL_HOSTING: "FALSE"
        },
        layer: []
    };

    if (wmsOnlineresourceUrl) {
        mapserverConf.web.metadata.wms_onlineresource = wmsOnlineresourceUrl
    }

    for (const [key, object] of Object.entries(objects)) {
        for (const type of types) {
            const filename = path.parse(object.Key).name;

            if (!indexes[type]) {
                indexes[type] = [];
            }

            if (filename.endsWith(type)) {
                indexes[type].push(object);
            }
        }
    }

    for (const type of types) {
        const typeIndexes = indexes[type];
        const tileIndexGeoJson = {
            type: "FeatureCollection",
            crs: {
                type: "name",
                properties: {
                    name: "EPSG:5514"
                }
            },
            features: []
        }
        
        const tileIndexTempFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-TIME-${type}.geojson`;
        const tileIndexFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-TIME-${type}.shp`;

        let minTime, maxTime, minX, minY, maxX, maxY;
        let availableTimes = [];

        for (const object of typeIndexes) {
            const location = `/vsis3/samas-mapservice/${object.Key}`;
            const time = path.parse(object.Key).name.split("_")[0];

            const momentTime = moment(time);
            const timeString = moment(momentTime).utc().format("");

            availableTimes.push(timeString);

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
                    location,
                    acquired: `#${timeString}`,
                    src_srs: object.srs
                }
            })
        }

        await fsp.writeFile(tileIndexTempFile, JSON.stringify(tileIndexGeoJson, null, 2));

        chp.execSync(`ogr2ogr -f "ESRI Shapefile" -overwrite ${tileIndexFile} ${tileIndexTempFile}`);
        chp.execSync(`ogrinfo -dialect sqlite -sql 'UPDATE "${path.parse(tileIndexFile).name}" SET acquired = substr(acquired, 2)' ${tileIndexFile}`);

        await fsp.unlink(tileIndexTempFile);

        availableTimes = availableTimes.sort();

        mapserverConf.layer.push({
            name: `SAMAS-TIME-${type}`,
            status: "ON",
            type: "RASTER",
            tileindex: tileIndexFile,
            tileitem: "location",
            tilesrs: "src_srs",
            projection: ["init=EPSG:5514"],
            class: styles[type],
            extent: [minX, minY, maxX, maxY],
            metadata: {
                wms_title: `SAMAS-TIME-${type}`,
                wms_srs: "EPSG:5514",
                wms_timeitem: "acquired",
                wms_timeextent: availableTimes.join(",")
                // wms_timedefault: maxTime
            }
        })
    }

    const mapFile = `${config.projects.samas.paths.mapproxyConf}/SAMAS-MapService.map`;

    await fsp.writeFile(mapFile, mapserver.getMapfileString(mapserverConf));
    console.log(`#SAMAS" Map service > WMS definitions updated`);
}


function getGdalInfo(file) {
    try {
        const output = execSync(
            `gdalinfo -json /vsis3/samas-mapservice/${file}`,
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
        return JSON.parse(output);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

async function getSrs(file) {
    try {
        const output = execSync(
            `gdalsrsinfo -o epsg --single-line /vsis3/samas-mapservice/${file}`,
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
        return output.toString().trim();
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

async function createMapproxyConfigurationFile(groupedFiles) {
    const sources = {};
    const caches = {};
    const layers = [];

    for (const date of Object.keys(groupedFiles)) {
        for (const type of types) {
            const file = groupedFiles[date][type];

            const bbox = [
                ...file.gdalInfo.cornerCoordinates.lowerLeft,
                ...file.gdalInfo.cornerCoordinates.upperRight
            ].join(",");

            sources[`source_${file.filename}`] = {
                type: "mapserver",
                req: {
                    layers: `SAMAS_${file.filename}`,
                    map: `${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`,
                    transparent: true
                },
                coverage: {
                    bbox,
                    srs: `EPSG:5514`
                },
                supported_srs: [`EPSG:5514`]
            }
            caches[`cache_${file.filename}`] = {
                sources: [`source_${file.filename}`],
                grids: ["KrovakEastNorth"],
                image: {
                    transparent: true,
                },
                use_direct_from_level: 8,
                cache: {
                    type: "couchdb",
                    db_name: `Samas_Sen2Previews_${file.filename}`,
                    url: "http://panther:panther@couchdb:5984",
                    // directory: `${config.projects.samas.paths.mapproxyCache}/${file.filename}`,
                    tile_lock_dir: `${config.projects.samas.paths.mapproxyCache}/Samas_Sen2Previews/${file.filename}/tile_lock`
                }
            }
            layers.push({
                name: file.filename,
                title: file.filename,
                sources: [`source_${file.filename}`]
            })
        }
    }

    const mapproxyConf = {
        services: {
            demo: {},
            wms: {
                srs: ["EPSG:5514"],
                versions: ["1.1.1", "1.3.0"],
                image_formats: ['image/png', 'image/jpeg'],
                md: {
                    title: "SAMAS | Sentinel-2 Previews"
                }
            }
        },
        grids: {
            KrovakEastNorth: {
                srs: "EPSG:5514",
                bbox: [-951499.37, -1276279.09, -159365.31, -983013.08],
                bbox_srs: "EPSG:5514",
                origin: "ll"
            }
        },
        sources,
        caches,
        layers
    };

    try {
        await fsp.writeFile(`${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.yaml`, mapproxy.getMapproxyYamlString(mapproxyConf));
    } catch (e) {
        console.log(e);
    }
}

async function createMapproxySeedConfigurationFile(groupedFiles) {
    const seeds = {};
    const coverages = {};

    Object.keys(groupedFiles).map((date) => {
        for (const type of types) {
            const file = groupedFiles[date][type];

            const bbox = getBbox(file.file);


        }
    });

    const mapproxySeedConf = {
        coverages,
        seeds
    };

    try {
        await fsp.writeFile(`${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.yaml`, mapproxy.getMapproxySeedYamlString(mapproxySeedConf));
    } catch (e) {
        console.log(e);
    }
}

async function createConfigurationFiles(updatedObjects, currentObjects) {
    const objectToSave = {
        ...currentObjects
    };

    for (const [key, object] of Object.entries(updatedObjects)) {
        const srs = await getSrs(object.Key);
        const gdalInfo = await getGdalInfo(object.Key);

        const extendedObject = {
            ...object,
            srs,
            gdalInfo
        }

        if (objectToSave[key]) {
            objectToSave[key] = {
                ...objectToSave[key],
                ...extendedObject
            }
        } else {
            objectToSave[key] = {
                ...extendedObject
            }
        }

        console.log(`#SAMAS# Map service > ${object.Key} was updated`);
    }

    await createMapserverConfigurationFile(objectToSave);

    return objectToSave;
}

async function run() {
    const nextObjects = await getS3Objects();
    const currentObjects = await getCurrectObjects();
    const updatedObjects = await getUpdatedS3Objects(nextObjects, currentObjects);

    if (Object.keys(updatedObjects).length) {
        const objectsToSave = await createConfigurationFiles(updatedObjects, currentObjects);
        await saveObjects(objectsToSave);
    }
}

run();