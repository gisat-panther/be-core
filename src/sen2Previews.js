const fsp = require('node:fs/promises');
const path = require('node:path');
const { execSync } = require('node:child_process');

const config = require('../config');
const mapserver = require('../src/modules/map/mapserver');
const mapproxy = require('../src/modules/map/mapproxy');

const runEvery = 60000;

const types = ["ndvi", "nir_pseudocolor", "true_color"];

function repeat() {
    setTimeout(() => {
        run();
    }, runEvery)
}

async function getGroupedFiles() {
    const files = await fsp.readdir(config.projects.samas.paths.previews);
    const grouped = {};

    if (files.length === 0) {
        return;
    }

    for (const file of files) {
        const filePathParsed = path.parse(file);
        const filename = filePathParsed.name;
        const ext = filePathParsed.ext;
        const [date, ...nameParts] = filename.split("_");
        const type = nameParts.join("_");

        grouped[date] = grouped[date] || {};
        grouped[date][type] = {
            file: `${config.projects.samas.paths.previews}/${file}`,
            filename,
            ext,
            date
        };
    }

    for (const group of Object.keys(grouped)) {
        for (const type of types) {
            if (!grouped[group][type]) {
                delete grouped[group];
                break;
            }
        }
    }

    return grouped;
}

async function getExistingGroups() {
    let groups = [];
    try {
        const statusTxt = await fsp.readFile(config.projects.samas.paths.statusFile);
        groups = JSON.parse(statusTxt);
    } catch (e) {
        console.log(e);
    }

    return groups;
}

async function setExistingGroups(groups) {
    try {
        await fsp.writeFile(config.projects.samas.paths.statusFile, JSON.stringify(groups));
    } catch (e) {
        console.log(e);
    }
}

async function createMapserverConfigurationFile(groupedFiles) {
    const layers = [];

    Object.keys(groupedFiles).map((date) => {
        const ndvi = groupedFiles[date].ndvi;
        const nir_pseudocolor = groupedFiles[date].nir_pseudocolor;
        const true_color = groupedFiles[date].true_color;

        layers.push({
            name: ndvi.filename,
            status: "ON",
            type: "RASTER",
            projection: ["AUTO"],
            data: ndvi.file,
            class: [
                {
                    expression: "[pixel] = 0",
                    style: {
                        opacity: 0
                    }
                },
                {
                    style: {
                        colorrange: [[97, 21, 13], [16, 69, 16]],
                        datarange: [1, 255]
                    }
                }
            ]
        });

        layers.push({
            name: nir_pseudocolor.filename,
            status: "ON",
            type: "RASTER",
            projection: ["AUTO"],
            data: nir_pseudocolor.file
        });

        layers.push({
            name: true_color.filename,
            status: "ON",
            type: "RASTER",
            projection: ["AUTO"],
            data: true_color.file,
        });
    })

    const mapserverConf = {
        name: "SAMAS_Sentinel2_Previews",
        units: "DD",
        web: {
            metadata: {
                "wms_enable_request": "*",
                "ows_enable_request": "*",
                "wms_srs": "EPSG:4326"
            }
        },
        projection: ["init=EPSG:4326"],
        layer: layers
    };

    try {
        await fsp.writeFile(`${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`, mapserver.getMapfileString(mapserverConf));
    } catch (e) {
        console.log(e);
    }
}

function getBbox(ndvi) {
    try {
        const output = execSync(`gdalinfo -json ${ndvi}`);
        const outputJson = JSON.parse(output);
        return [
            ...outputJson.cornerCoordinates.lowerLeft,
            ...outputJson.cornerCoordinates.upperRight
        ].join(",");
    } catch (e) {
        console.log(e);
    }
}

async function createMapproxyConfigurationFiles(groupedFiles) {
    const sources = {};
    const caches = {};
    const layers = [];

    Object.keys(groupedFiles).map((date) => {
        const ndvi = groupedFiles[date].ndvi;
        const nir_pseudocolor = groupedFiles[date].nir_pseudocolor;
        const true_color = groupedFiles[date].true_color;

        const bbox = getBbox(ndvi.file);

        sources[ndvi.filename] = {
            type: "mapserver",
            req: {
                layers: `${ndvi.filename}`,
                map: `${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`,
                transparent: true
            },
            coverage: {
                bbox,
                srs: `EPSG:4326`
            },
            supported_srs: [`EPSG:4326`]
        }
        caches[`cache_${ndvi.filename}`] = {
            sources: [ndvi.filename],
            grids: ["GLOBAL_GEODETIC"],
            image: {
                transparent: true,
                resampling_method: "nearest"
            },
            cache: {
                type: "sqlite",
                directory: `${config.projects.samas.paths.mapproxyCache}/${ndvi.filename}`,
                tile_lock_dir: `${config.projects.samas.paths.mapproxyCache}/${ndvi.filename}/tile_lock`
            }
        }
        layers.push({
            name: ndvi.filename,
            title: ndvi.filename,
            sources: [`cache_${ndvi.filename}`]
        })

        sources[nir_pseudocolor.filename] = {
            type: "mapserver",
            req: {
                layers: `${nir_pseudocolor.filename}`,
                map: `${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`,
                transparent: true
            },
            coverage: {
                bbox,
                srs: `EPSG:4326`
            },
            supported_srs: [`EPSG:4326`]
        }
        caches[`cache_${nir_pseudocolor.filename}`] = {
            sources: [nir_pseudocolor.filename],
            grids: ["GLOBAL_GEODETIC"],
            image: {
                transparent: true,
                resampling_method: "nearest"
            },
            cache: {
                type: "sqlite",
                directory: `${config.projects.samas.paths.mapproxyCache}/${nir_pseudocolor.filename}`,
                tile_lock_dir: `${config.projects.samas.paths.mapproxyCache}/${nir_pseudocolor.filename}/tile_lock`
            }
        }
        layers.push({
            name: nir_pseudocolor.filename,
            title: nir_pseudocolor.filename,
            sources: [`cache_${nir_pseudocolor.filename}`]
        })

        sources[true_color.filename] = {
            type: "mapserver",
            req: {
                layers: `${true_color.filename}`,
                map: `${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`,
                transparent: true
            },
            coverage: {
                bbox,
                srs: `EPSG:4326`
            },
            supported_srs: [`EPSG:4326`]
        }
        caches[`cache_${true_color.filename}`] = {
            sources: [true_color.filename],
            grids: ["GLOBAL_GEODETIC"],
            image: {
                transparent: true,
                resampling_method: "nearest"
            },
            cache: {
                type: "sqlite",
                directory: `${config.projects.samas.paths.mapproxyCache}/${true_color.filename}`,
                tile_lock_dir: `${config.projects.samas.paths.mapproxyCache}/${true_color.filename}/tile_lock`
            }
        }
        layers.push({
            name: true_color.filename,
            title: true_color.filename,
            sources: [`cache_${true_color.filename}`]
        })
    });

    const mapproxyConf = {
        services: {
            demo: {},
            wms: {
                srs: ["EPSG:4326"],
                versions: ["1.1.1", "1.3.0"],
                image_formats: ['image/png', 'image/jpeg'],
                md: {
                    title: "SAMAS | Sentinel-2 Previews",
                    online_resource: `${config.url}/proxy/wms`
                }
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

async function createConfigurationFiles(groupedFiles) {
    await createMapserverConfigurationFile(groupedFiles);
    await createMapproxyConfigurationFiles(groupedFiles);
}

async function run() {
    const groupedFiles = await getGroupedFiles();
    const existingGroups = await getExistingGroups();

    if (Object.keys(groupedFiles).length && Object.keys(groupedFiles).length !== existingGroups.length) {
        await createConfigurationFiles(groupedFiles);
        await setExistingGroups(Object.keys(groupedFiles));

        console.log("#SAMAS# WMS definitions was updated!")
    }

    repeat();
}

async function init() {
    run();
}

init();