const {
    S3Client,
    ListObjectsCommand,
    GetObjectCommand
} = require('@aws-sdk/client-s3');
const path = require('path');
const chp = require('child_process');
const fsp = require('fs/promises');

const mapserver = require('../../../src/modules/map/mapserver');
const mapproxy = require('../../../src/modules/map/mapproxy');

async function listS3ObjectKeys({ s3Client, bucket, marker, prefix, files = [] }) {
    const listCommand = new ListObjectsCommand({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
    })

    const response = await s3Client.send(listCommand);

    response.Contents.forEach((object) => {
        if (object.Key.toLowerCase().endsWith(".tif") || object.Key.toLowerCase().endsWith(".tiff")) {
            files.push(object.Key);
        }
    })

    if (response.NextMarker) {
        return await listS3ObjectKeys({ s3Client, bucket, marker: response.NextMarker, prefix, files });
    } else {
        return files;
    }
}

async function getVsis3Paths(options) {
    const s3Client = new S3Client({
        endpoint: `${options.s3.protocol ? options.s3.protocol + '://' : ''}` + options.s3.endpoint,
        region: options.s3.endpoint,
        forcePathStyle: options.s3.forcePathStyle,
        credentials: options.s3.credentials
    });

    const s3ObjectKeys = await listS3ObjectKeys({ s3Client, bucket: options.s3.bucket, prefix: options.s3.prefix });
    const vsis3FilePaths = s3ObjectKeys.map((objectKey) => `/vsis3/${options.s3.bucket}/${objectKey}`);

    return vsis3FilePaths;
}

async function getMapserverOptions(vsis3Paths, options) {
    const mapserverOptions = {
        fileName: `${options.group}.map`,
        layers: []
    };

    for (const vsis3Path of vsis3Paths) {
        const bbox = await getLayerBBOX(vsis3Path, options);
        let name = path.parse(vsis3Path).name;

        const sameLayersByName = mapserverOptions.layers.filter((layer) => layer.name === name);
        if (sameLayersByName.length > 0) {
            name += `_${sameLayersByName.length}`;
        }

        mapserverOptions.layers.push({
            name,
            status: "on",
            data: vsis3Path,
            type: "raster",
            projection: "epsg:" + options.epsg,
            bbox
        })
    }

    mapserverOptions.mapfile = mapserver.getMapfileString({
        name: options.group,
        projection: `epsg:${options.epsg}`,
        config: [
            ["AWS_SECRET_ACCESS_KEY", options.s3.credentials.secretAccessKey],
            ["AWS_ACCESS_KEY_ID", options.s3.credentials.accessKeyId],
            ["AWS_S3_ENDPOINT", options.s3.endpoint],
            ["AWS_VIRTUAL_HOSTING", String(options.s3.forcePathStyle).toUpperCase()]
        ],
        layers: mapserverOptions.layers
    })

    return mapserverOptions;
}

async function getLayerBBOX(vsis3Path, options) {
    const gdalInfoStr = chp.execSync(`gdalinfo \
    --config "AWS_SECRET_ACCESS_KEY" "${options.s3.credentials.secretAccessKey}" \
    --config "AWS_ACCESS_KEY_ID" "${options.s3.credentials.accessKeyId}" \
    --config "AWS_S3_ENDPOINT" "${options.s3.endpoint}" \
    --config "AWS_VIRTUAL_HOSTING" "${String(options.s3.forcePathStyle).toLocaleUpperCase()}" \
    -json \
    ${vsis3Path}
    `).toString();

    const cornerCoordinates = JSON.parse(gdalInfoStr).cornerCoordinates;

    return [].concat(cornerCoordinates.lowerLeft, cornerCoordinates.upperRight);
}

async function getMapproxyOptions(mapserverOptions, options) {
    const sources = {};
    const caches = {};
    const layers = [];

    for (const mapserverLayer of mapserverOptions.layers) {
        sources[mapserverLayer.name] = {
            type: "mapserver",
            req: {
                layers: mapserverLayer.name,
                map: mapserverOptions.fileName,
                transparent: true
            },
            coverage: {
                bbox: mapserverLayer.bbox,
                srs: `epsg:${options.epsg}`
            },
            supported_srs: [`epsg:${options.epsg}`]
        }
        caches[mapserverLayer.name] = {
            sources: [mapserverLayer.name],
            grids: ["GLOBAL_WEBMERCATOR"],
            image: {
                transparent: true,
                resampling: "nearest",
                colors: 0,
                mode: "RGBA"
            },
            cache: {
                type: "sqlite",
                directory: `../cache/${options.group}/${mapserverLayer.name}`,
                tile_lock_dir: `../cache/${options.group}/${mapserverLayer.name}/tile_lock`
            }
        }
        layers.push({
            name: mapserverLayer.name,
            title: mapserverLayer.name,
            sources: [mapserverLayer.name]
        })
    }

    return {
        fileName: `${options.group}.yaml`,
        conf: mapproxy.getMapproxyYamlString({
            services: {
                wms: {
                    srs: ["EPSG:4326", "EPSG:3857"],
                    versions: ["1.1.1", "1.3.0"],
                    image_formats: ["image/png", "image/jpeg"]
                },
                demo: {}
            },
            sources,
            caches,
            layers
        })
    };
}

async function createMapserverMapfile(mapserverOptions) {
    await fsp.writeFile(`./${mapserverOptions.fileName}`, mapserverOptions.mapfile);
}

async function createMapproxyConfig(mapproxyOptions) {
    await fsp.writeFile(`./${mapproxyOptions.fileName}`, mapproxyOptions.conf);
}

async function s3(options) {
    const vsis3Paths = await getVsis3Paths(options);
    const mapserverOptions = await getMapserverOptions(vsis3Paths, options);
    const mapproxyOptions = await getMapproxyOptions(mapserverOptions, options);

    await createMapserverMapfile(mapserverOptions);
    await createMapproxyConfig(mapproxyOptions);

    return Promise.resolve({ mapserverOptions, mapproxyOptions });
}

module.exports = {
    s3
}