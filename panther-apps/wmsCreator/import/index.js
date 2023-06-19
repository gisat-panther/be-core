const {
    S3Client,
    ListObjectsCommand,
    GetObjectCommand
} = require('@aws-sdk/client-s3');
const path = require('path');
const chp = require('child_process');
const fsp = require('fs/promises');
const fetch = require('node-fetch');
const xml2js = require('xml-js');

const mapserver = require('../../../src/modules/map/mapserver');
const mapproxy = require('../../../src/modules/map/mapproxy');

const fsUtils = require('../../../src/util/fs');

const config = require('../../../config');

const DEFAULT_TEMPLATE = `<!-- mapserver template -->\n{\"layer\":\"[cl]\",\"x\":[x],\"y\":[y],\"value_list\":\"[value_list]\",\"class\":\"[class]\"}`;

async function getFilesRecursive({ basePath, files = [] }) {
    console.log(basePath);
    const ents = await fsp.readdir(basePath, { withFileTypes: true });

    for (const ent of ents) {
        if (ent.isDirectory()) {
            await getFilesRecursive({ basePath: `${basePath}/${ent.name}`, files });
        } else {
            const key = `${basePath}/${ent.name}`.replace(`${config.mapproxy.paths.datasource}/`, "");
            const path = `${basePath}/${ent.name}`;

            if (key.toLowerCase().endsWith(".tif") || key.toLowerCase().endsWith(".tiff")) {
                files.push({
                    key,
                    type: "raster",
                    path
                })
            } else if (key.toLowerCase().endsWith(".style")) {
                files.push({
                    key,
                    type: "style",
                    path
                })
            } else if (key.toLowerCase().endsWith(".shp")) {
                files.push({
                    key,
                    type: "vector",
                    path
                })
            }
        }
    }

    return files;
}

async function listLocalFiles({ options }) {
    return getFilesRecursive({ basePath: `${config.mapproxy.paths.datasource}${options.prefix ? `/${options.prefix}` : ""}` });
}

async function listS3Files({ s3Client, options, marker, files = [] }) {
    const listCommand = new ListObjectsCommand({
        Bucket: options.s3.bucket,
        Prefix: options.s3.prefix,
        Marker: marker
    })

    const response = await s3Client.send(listCommand);

    response.Contents.forEach((object) => {
        if (object.Key.toLowerCase().endsWith(".tif") || object.Key.toLowerCase().endsWith(".tiff")) {
            files.push({
                key: object.Key,
                type: "raster",
                path: `/vsis3/${options.s3.bucket}/${object.Key}`
            })
        } else if (object.Key.toLowerCase().endsWith(".style") || object.Key.toLowerCase().endsWith(".sld")) {
            files.push({
                key: object.Key,
                type: "style",
                path: `${options.s3.protocol || "http"}://${options.s3.endpoint}/${options.s3.bucket}/${object.Key}`
            })
        } else if (object.Key.toLowerCase().endsWith(".shp")) {
            files.push({
                key: object.Key,
                type: "vector",
                path: `/vsis3/${options.s3.bucket}/${object.Key}`
            })
        }
    })

    if (response.NextMarker) {
        return await listS3Files({ s3Client, options, marker: response.NextMarker, files });
    } else {
        return files;
    }
}

async function getRasterEpsg(file, options, storage) {
    let env;
    if (storage === "s3") {
        env = {
            AWS_SECRET_ACCESS_KEY: options.s3.credentials.secretAccessKey,
            AWS_ACCESS_KEY_ID: options.s3.credentials.accessKeyId,
            AWS_S3_ENDPOINT: options.s3.endpoint,
            AWS_VIRTUAL_HOSTING: String(options.s3.forcePathStyle).toLocaleUpperCase()
        };
    }
    const gdalSrsInfo = chp.execSync(`gdalsrsinfo -o PROJJSON ${file}`, { env });
    const gdalSrsInfoStr = gdalSrsInfo.toString();
    const gdalSrsInfoJson = JSON.parse(gdalSrsInfoStr);

    return gdalSrsInfoJson.id.code;
}

async function getFiles(options, storage) {
    let files;
    if (storage === "s3") {
        const s3Client = new S3Client({
            endpoint: `${options.s3.protocol ? options.s3.protocol + '://' : ''}` + options.s3.endpoint,
            region: options.s3.endpoint,
            forcePathStyle: options.s3.forcePathStyle,
            credentials: options.s3.credentials
        });

        files = await listS3Files({ s3Client, options });
    } else {
        files = await listLocalFiles({ options });
    }

    const filesWithProps = files.map((file) => {
        const group = path.parse(file.key).dir.replaceAll("/", "_");

        if (file.type === "raster" || file.type === "vector") {
            return {
                ...file,
                group
            }
        } else {
            return {
                ...file,
                group
            }
        }
    });

    const groupedFiles = () => {
        let groups = {};

        for (const fileWithProps of filesWithProps) {
            groups[fileWithProps.group] = groups[fileWithProps.group] || [];
            groups[fileWithProps.group].push(fileWithProps);
        }

        return groups;
    }

    return groupedFiles();
}

async function getJsonStyleFromS3(styleFileMeta, options) {
    const s3Client = new S3Client({
        endpoint: `${options.s3.protocol ? options.s3.protocol + '://' : ''}` + options.s3.endpoint,
        region: options.s3.endpoint,
        forcePathStyle: options.s3.forcePathStyle,
        credentials: options.s3.credentials
    });

    const s3GetObjectCommandInput = {
        Bucket: options.s3.bucket,
        Key: styleFileMeta.key
    };

    const s3GetObjectCommand = new GetObjectCommand(s3GetObjectCommandInput);
    const response = await s3Client.send(s3GetObjectCommand);

    const streamToString = async (stream) => {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    const content = await streamToString(response.Body);

    if (styleFileMeta.key.endsWith(".style")) {
        return JSON.parse(content);
    } else if (styleFileMeta.key.endsWith(".sld")) {
        const jsonSld = xml2js.xml2js(content, { compact: true });
        const colorMap = jsonSld.StyledLayerDescriptor.UserLayer['sld:UserStyle']['sld:FeatureTypeStyle']['sld:Rule']['sld:RasterSymbolizer']['sld:ColorMap']['sld:ColorMapEntry'].map((entry) => entry._attributes);

        if (!colorMap) {
            console.log(`Unable to parse color map from ${styleFileMeta.key}`);
            return;
        }

        let style = [];

        for (const colorEntry of colorMap) {
            const pixel = Number(colorEntry.quantity);
            const opacity = Number(colorEntry.opacity || 1) * 100
            const name = colorEntry.label;
            const color = colorEntry.color;

            style.push({
                name,
                expression: `[pixel] = ${pixel}`,
                style: {
                    color,
                    opacity
                }
            });
        }

        return style;
    }
}

async function getMapserverOptions(s3Files, options, storage) {
    const mapserverOptions = {
        fileName: `${options.group}.map`,
        layers: []
    };

    const rasterFiles = s3Files.filter((s3File) => s3File.type === "raster");
    const styleFiles = s3Files.filter((s3File) => s3File.type === "style");
    const vectorFiles = s3Files.filter((s3File) => s3File.type === "vector");

    for (const rasterFile of rasterFiles) {
        const bbox = await getRasterBBOX(rasterFile.path, options, storage);
        const epsg = await getRasterEpsg(rasterFile.path, options, storage);
        const rasterFilePathParsed = path.parse(rasterFile.key);
        const rasterFileName = rasterFilePathParsed.name;

        const styles = styleFiles.filter((styleFile) => {
            const styleFilePathParsed = path.parse(styleFile.key);
            const styleName = styleFilePathParsed.name;
            return rasterFileName === styleName || (styleName === "default" && styleFilePathParsed.dir === rasterFilePathParsed.dir);
        });

        let rasterFileStyle = styles.find((style) => {
            return path.parse(style.key).name === rasterFileName;
        })
        let rasterFileDefaultStyle = styles.find((style) => {
            return path.parse(style.key).name === "default";
        });

        const style = rasterFileStyle || rasterFileDefaultStyle;

        let stylesJson;
        if (style) {
            stylesJson = await getJsonStyleFromS3(style, options);
        }

        const sameLayersByName = mapserverOptions.layers.filter((layer) => layer.name === rasterFileName);
        if (sameLayersByName.length > 0) {
            rasterFileName += `_${sameLayersByName.length}`;
        }

        let layer = {
            name: rasterFileName,
            status: "on",
            data: rasterFile.path,
            type: "raster",
            projection: [`init=epsg:${epsg}`],
            _bbox: bbox,
            _epsg: epsg,
            template: `${options.group}.template.html`,
            class: stylesJson
        }

        if (options.public) {
            layer._publicPath = `${options.s3.protocol}://${options.s3.bucket}.${options.s3.endpoint}/${rasterFile.key}`;
        }

        mapserverOptions.layers.push(layer)

        console.log(`# IMPORT # ${rasterFile.path} with ${style && path.parse(style.path).name} style.`);
    }

    for (const vectorFile of vectorFiles) {
        const bbox = await getVectorBBOX(vectorFile.path, options, storage);
        const epsg = await getRasterEpsg(vectorFile.path, options, storage);
        const vectorFilePathParsed = path.parse(vectorFile.key);
        const vectorFileName = vectorFilePathParsed.name;

        const styles = styleFiles.filter((styleFile) => {
            const styleFilePathParsed = path.parse(styleFile.key);
            const styleName = styleFilePathParsed.name;
            return vectorFileName === styleName || (styleName === "default" && styleFilePathParsed.dir === vectorFilePathParsed.dir);
        });

        let vectorFileStyle = styles.find((style) => {
            return path.parse(style.key).name === vectorFileName;
        })
        let vectorFileDefaultStyle = styles.find((style) => {
            return path.parse(style.key).name === "default";
        });

        const style = vectorFileStyle || vectorFileDefaultStyle;

        let stylesJson;
        if (style && storage === "s3") {
            const response = await fetch(style.path);
            stylesJson = await response.json();
        } else if (style && storage === "local") {
            const fileContent = await fsp.readFile(style.path);
            stylesJson = JSON.parse(fileContent);
        }

        const sameLayersByName = mapserverOptions.layers.filter((layer) => layer.name === vectorFileName);
        if (sameLayersByName.length > 0) {
            vectorFileName += `_${sameLayersByName.length}`;
        }

        mapserverOptions.layers.push({
            name: vectorFileName,
            status: "on",
            data: vectorFile.path,
            type: "polygon",
            projection: [`init=epsg:${epsg}`],
            _bbox: bbox,
            _epsg: epsg,
            template: `${options.group}.template.html`,
            class: stylesJson
        })

        console.log(`# IMPORT # ${vectorFile.path} with ${style ? path.parse(style.path).name : "no"} style.`);
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
        layer: mapserverOptions.layers
    };

    if (storage === "s3") {
        mapfileOptions.config = {
            "AWS_SECRET_ACCESS_KEY": options.s3.credentials.secretAccessKey,
            "AWS_ACCESS_KEY_ID": options.s3.credentials.accessKeyId,
            "AWS_S3_ENDPOINT": options.s3.endpoint,
            "AWS_VIRTUAL_HOSTING": String(options.s3.forcePathStyle).toUpperCase()
        }
    }

    if (options.featureinfo) {
        mapfileOptions.web.metadata["wms_feature_info_mime_type"] = "text/html";
    }

    mapserverOptions.mapfile = mapserver.getMapfileString(mapfileOptions);

    return mapserverOptions;
}

async function getRasterBBOX(vsis3Path, options) {
    const gdalInfo = chp.execSync(
        `gdalinfo -json ${vsis3Path}`,
        {
            env: {
                AWS_SECRET_ACCESS_KEY: options.s3.credentials.secretAccessKey,
                AWS_ACCESS_KEY_ID: options.s3.credentials.accessKeyId,
                AWS_S3_ENDPOINT: options.s3.endpoint,
                AWS_VIRTUAL_HOSTING: String(options.s3.forcePathStyle).toLocaleUpperCase()
            }
        });
    const gdalInfoStr = gdalInfo.toString();
    const cornerCoordinates = JSON.parse(gdalInfoStr).cornerCoordinates;

    return [].concat(cornerCoordinates.lowerLeft, cornerCoordinates.upperRight);
}

async function getVectorBBOX(vsis3Path, options, storage) {
    let env;
    if (storage === "s3") {
        env = {
            AWS_SECRET_ACCESS_KEY: options.s3.credentials.secretAccessKey,
            AWS_ACCESS_KEY_ID: options.s3.credentials.accessKeyId,
            AWS_S3_ENDPOINT: options.s3.endpoint,
            AWS_VIRTUAL_HOSTING: String(options.s3.forcePathStyle).toLocaleUpperCase()
        };
    }

    const ogrInfo = chp.execSync(`ogrinfo -al -so ${vsis3Path} | grep Extent`, { env });
    const ogrInfoStr = ogrInfo.toString();
    const ogrInfoStrTrim = ogrInfoStr.trim().replace(/\s+/g, '');
    const ogrInfoMatch = ogrInfoStrTrim.match(/^.*\((.*)\)\-\((.*)\)$/);

    return [].concat(ogrInfoMatch[1].split(","), ogrInfoMatch[2].split(",")).map(Number);
}

async function getMapproxyOptions(mapserverOptions, options) {
    const sources = {};
    const caches = {};
    const layers = [];

    for (const mapserverLayer of mapserverOptions.layers) {
        const sourceName = `source_${mapserverLayer.name}`;
        const cacheName = `cache_${mapserverLayer.name}`;
        let wms_opts;

        if (options.featureinfo) {
            wms_opts = {
                featureinfo: true,
                featureinfo_format: "text/html"
            }
        }

        sources[sourceName] = {
            type: "mapserver",
            req: {
                layers: mapserverLayer.name,
                map: mapserverOptions.fileName,
                transparent: true
            },
            coverage: {
                bbox: mapserverLayer._bbox,
                srs: `epsg:${mapserverLayer._epsg}`
            },
            supported_srs: [`epsg:${mapserverLayer._epsg}`],
            wms_opts
        }
        caches[cacheName] = {
            sources: [sourceName],
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

        let layer = {
            name: mapserverLayer.name,
            title: mapserverLayer.name,
            sources: [cacheName]
        };

        if (mapserverLayer._publicPath) {
            layer.md = {
                data: [{
                    url: mapserverLayer._publicPath
                }]
            }
        }

        layers.push(layer);
    }

    return {
        fileName: `${options.group}.yaml`,
        layers,
        conf: mapproxy.getMapproxyYamlString({
            services: {
                wms: {
                    srs: ["EPSG:4326", "EPSG:3857"],
                    versions: ["1.1.1", "1.3.0"],
                    image_formats: ["image/png", "image/jpeg"]
                },
                wmts: {},
                demo: {}
            },
            sources,
            caches,
            layers
        })
    };
}

async function createMapserverMapfile(mapserverOptions) {
    await fsp.writeFile(`${config.mapproxy.paths.conf}/${mapserverOptions.fileName}`, mapserverOptions.mapfile);
}

async function createMapserverTemplateFile({ group, template }) {
    await fsp.writeFile(`${config.mapproxy.paths.conf}/${group}.template.html`, template);
}

async function createMapproxyConfig(mapproxyOptions) {
    await fsp.writeFile(`${config.mapproxy.paths.conf}/${mapproxyOptions.fileName}`, mapproxyOptions.conf);
}

async function clearMapproxyCache(prefix) {
    const filesToClear = await fsUtils.getFilesAtPathRecursive(`${config.mapproxy.paths.cache}/${prefix}`);

    for (const fileToClear of filesToClear) {
        await fsp.rm(fileToClear);
        console.log(`# IMPORT # Cleared tile cache at ${fileToClear}`);
    }
}

async function createWmsConfigurationFiles(options, storage) {
    const files = await getFiles(options, storage);

    let wmsMetadata = [];

    for (const group of Object.keys(files)) {
        const mapserverOptions = await getMapserverOptions(files[group], { ...options, group }, storage);
        const mapproxyOptions = await getMapproxyOptions(mapserverOptions, { ...options, group }, storage);

        await createMapserverMapfile(mapserverOptions);
        await createMapproxyConfig(mapproxyOptions);

        await createMapserverTemplateFile({ group, template: options.template ? options.template : DEFAULT_TEMPLATE });

        if (options.clearCache) {
            await clearMapproxyCache(group);
        }

        wmsMetadata.push({
            url: `${config.mapproxy.url}/${group}/wms`,
            capabilities: `${config.mapproxy.url}/${group}/wms?REQUEST=GetCapabilities`,
            layers: mapserverOptions.layers.map((layer) => {
                return {
                    name: layer.name, 
                    source: layer._publicPath
                }
            }),
            epsg: options.epsg
        });
    }

    return Promise.resolve({
        wms: wmsMetadata
    });
}

async function s3(options) {
    return createWmsConfigurationFiles(options, "s3");
}

async function local(options) {
    return createWmsConfigurationFiles(options, "local");
}

module.exports = {
    s3,
    local
}