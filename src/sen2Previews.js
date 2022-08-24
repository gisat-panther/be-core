const fsp = require('node:fs/promises');
const path = require('node:path');

const config = require('../config');
const mapserver = require('../src/modules/map/mapserver');
const mapproxy = require('../src/modules/map/mapproxy');

const runEvery = 60000;

function repeat() {
    setTimeout(() => {
        run();
    }, runEvery)
}

async function getGroupedFiles() {
    const files = await fsp.readdir(config.projects.samas.paths.previews);
    const grouped = {};

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

    return grouped;
}

async function getLatestFileDate(groupedFiles) {
    let lastDate;
    for (const date of Object.keys(groupedFiles)) {
        if (!lastDate || lastDate < date) {
            lastDate = date;
        }
    }

    return lastDate;
}

async function getStatus() {
    try {
        const statusTxt = await fsp.readFile(config.projects.samas.paths.statusFile);
        return JSON.parse(statusTxt);
    } catch (e) {
        console.log(e);
    }
}

async function setStatus(status) {
    try {
        await fsp.writeFile(config.projects.samas.paths.statusFile, JSON.stringify(status));
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

async function createMapproxyConfigurationFiles(groupedFiles) {
    const sources = {};
    const caches = {};
    const layers = [];

    Object.keys(groupedFiles).map((date) => {
        const footprint = groupedFiles[date].footprint;
        const ndvi = groupedFiles[date].ndvi;
        const nir_pseudocolor = groupedFiles[date].nir_pseudocolor;
        const true_color = groupedFiles[date].true_color;

        sources[ndvi.filename] = {
            type: "mapserver",
            req: {
                layers: `${ndvi.filename}`,
                map: `${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.map`,
                transparent: true
            },
            coverage: {
                datasource: footprint.file,
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
                datasource: footprint.file,
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
                datasource: footprint.file,
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
    const status = await getStatus();
    const groupedFiles = await getGroupedFiles();
    const last = await getLatestFileDate(groupedFiles);

    if (!status || status.last != last) {
        await createConfigurationFiles(groupedFiles);
        await setStatus({ last });

        console.log("#SAMAS# WMS definitions was updated!")
    }

    repeat();
}

async function init() {
    run();
}

init();