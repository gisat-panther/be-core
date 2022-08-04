const {
    S3Client,
    ListObjectsCommand,
    GetObjectCommand
} = require('@aws-sdk/client-s3');
const path = require('path');
const chp = require('child_process');
const fsp = require('fs/promises');
const fetch = require('node-fetch');

const mapserver = require('../../../src/modules/map/mapserver');
const mapproxy = require('../../../src/modules/map/mapproxy');

async function listS3Files({ s3Client, bucket, marker, prefix, files = [] }) {
    const listCommand = new ListObjectsCommand({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
    })

    const response = await s3Client.send(listCommand);

    response.Contents.forEach((object) => {
        if (object.Key.toLowerCase().endsWith(".tif") || object.Key.toLowerCase().endsWith(".tiff")) {
            files.push({
                type: "raster",
                file: object.Key
            })
        } else if (object.Key.toLowerCase().endsWith(".style")) {
            files.push({
                type: "style",
                file: object.Key
            })
        }
    })

    if (response.NextMarker) {
        return await listS3Files({ s3Client, bucket, marker: response.NextMarker, prefix, files });
    } else {
        return files;
    }
}

async function updatePathsForVsi(options) {
    const s3Client = new S3Client({
        endpoint: `${options.s3.protocol ? options.s3.protocol + '://' : ''}` + options.s3.endpoint,
        region: options.s3.endpoint,
        forcePathStyle: options.s3.forcePathStyle,
        credentials: options.s3.credentials
    });

    const s3Files = await listS3Files({ s3Client, bucket: options.s3.bucket, prefix: options.s3.prefix });
    const vsis3FilePaths = s3Files.map((s3File) => {
        if (s3File.type === "raster") {
            return {
                ...s3File,
                file: `/vsis3/${options.s3.bucket}/${s3File.file}`
            }
        } else {
            return {
                ...s3File,
                file: `${options.s3.protocol || "http"}://${options.s3.endpoint}/${options.s3.bucket}/${s3File.file}`
            }
        }
    });

    return vsis3FilePaths;
}

async function getMapserverOptions(s3Files, options) {
    const mapserverOptions = {
        fileName: `${options.group}.map`,
        layers: []
    };

    const rasterFiles = s3Files.filter((s3File) => s3File.type === "raster");
    const styleFiles = s3Files.filter((s3File) => s3File.type === "style");

    for (const rasterFile of rasterFiles) {
        const bbox = await getLayerBBOX(rasterFile.file, options);
        const styles = styleFiles.filter((styleFile) => {
            const styleName = path.parse(styleFile.file).name;
            return path.parse(rasterFile.file).name === styleName;
        });
        let name = path.parse(rasterFile.file).name;

        let stylesJson;
        if (styles.length) {
            const style = styles[0];
            const response = await fetch(style.file);
            stylesJson = await response.json();
        }

        const sameLayersByName = mapserverOptions.layers.filter((layer) => layer.name === name);
        if (sameLayersByName.length > 0) {
            name += `_${sameLayersByName.length}`;
        }

        mapserverOptions.layers.push({
            name,
            status: "on",
            data: rasterFile.file,
            type: "raster",
            projection: [`init=epsg:${options.epsg}`],
            _bbox: bbox,
            template: `${options.group}.template.html`,
            class: stylesJson
        })

        console.log(`# IMPORT # ${rasterFile.file}`);
    }

    const mapfileOptions = {
        name: options.group,
        units: "dd",
        projection: [`init=epsg:${options.epsg}`],
        web: {
            metadata: {
                "wms_enable_request": "*",
                "ows_enable_request": "*"
            }
        },
        config: {
            "AWS_SECRET_ACCESS_KEY": options.s3.credentials.secretAccessKey,
            "AWS_ACCESS_KEY_ID": options.s3.credentials.accessKeyId,
            "AWS_S3_ENDPOINT": options.s3.endpoint,
            "AWS_VIRTUAL_HOSTING": String(options.s3.forcePathStyle).toUpperCase()
        },
        layer: mapserverOptions.layers
    };

    if (options.featureinfo) {
        mapfileOptions.web.metadata["wms_feature_info_mime_type"] = "text/html";
    }

    mapserverOptions.mapfile = mapserver.getMapfileString(mapfileOptions);

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
        let wms_opts;

        if (options.featureinfo) {
            wms_opts = {
                featureinfo: true,
                featureinfo_format: "text/html"
            }
        }

        sources[mapserverLayer.name] = {
            type: "mapserver",
            req: {
                layers: mapserverLayer.name,
                map: mapserverOptions.fileName,
                transparent: true
            },
            coverage: {
                bbox: mapserverLayer._bbox,
                srs: `epsg:${options.epsg}`
            },
            supported_srs: [`epsg:${options.epsg}`],
            wms_opts
        }
        caches[mapserverLayer.name] = {
            sources: [mapserverLayer.name],
            grids: ["GLOBAL_WEBMERCATOR"],
            image: {
                transparent: true,
                resampling_method: "nearest",
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

async function createMapserverTemplateFile(options) {
    await fsp.writeFile(`./${options.group}.template.html`, options.template);
}

async function createMapproxyConfig(mapproxyOptions) {
    await fsp.writeFile(`./${mapproxyOptions.fileName}`, mapproxyOptions.conf);
}

async function s3(options) {
    const vsis3Files = await updatePathsForVsi(options);
    const mapserverOptions = await getMapserverOptions(vsis3Files, options);
    const mapproxyOptions = await getMapproxyOptions(mapserverOptions, options);

    await createMapserverMapfile(mapserverOptions);
    await createMapproxyConfig(mapproxyOptions);

    if (options.template) {
        await createMapserverTemplateFile(options);
    }

    return Promise.resolve({ mapserverOptions, mapproxyOptions });
}

module.exports = {
    s3
}