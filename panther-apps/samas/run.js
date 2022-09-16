const fsp = require('node:fs/promises');
const path = require('node:path');
const { execSync } = require('node:child_process');

const config = require('../../config');
const mapserver = require('../../src/modules/map/mapserver');
const mapproxy = require('../../src/modules/map/mapproxy');

const types = ["ndvi", "nir_pseudocolor", "true_color"];
const styles = {
    ndvi: require('./styles/ndvi_spojity_v2.json')
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
        for (const type of types) {
            const file = groupedFiles[date][type];

            layers.push({
                name: file.filename,
                status: "ON",
                type: "RASTER",
                projection: ["AUTO"],
                data: file.file,
                class: styles[type]
            });
        }
    })

    const mapserverConf = {
        name: "SAMAS_Sentinel2_Previews",
        units: "DD",
        web: {
            metadata: {
                "wms_enable_request": "*",
                "ows_enable_request": "*",
                "wms_srs": "EPSG:5514"
            }
        },
        projection: ["init=EPSG:5514"],
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

async function createMapproxyConfigurationFile(groupedFiles) {
    const sources = {};
    const caches = {};
    const layers = [];

    Object.keys(groupedFiles).map((date) => {
        for (const type of types) {
            const file = groupedFiles[date][type];

            const bbox = getBbox(file.file);

            sources[`source_${file.filename}`] = {
                type: "mapserver",
                req: {
                    layers: `${file.filename}`,
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
                sources: [file.filename],
                grids: ["KrovakEastNorth"],
                image: {
                    mode: "RGB",
                    colors: 0,
                    transparent: true,
                },
                use_direct_from_level: 8,
                cache: {
                    type: "sqlite",
                    directory: `${config.projects.samas.paths.mapproxyCache}/${file.filename}`,
                    tile_lock_dir: `${config.projects.samas.paths.mapproxyCache}/${file.filename}/tile_lock`
                }
            }
            layers.push({
                name: file.filename,
                title: file.filename,
                sources: [`source_${file.filename}`]
            })
        }
    });

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

// async function createMapproxySeedConfigurationFile(groupedFiles) {
//     const seeds = {};
//     const coverages = {};

//     Object.keys(groupedFiles).map((date) => {
//         for (const type of types) {
//             const file = groupedFiles[date][type];

//             const bbox = getBbox(file.file);


//         }
//     });

//     const mapproxySeedConf = {
//         coverages,
//         seeds
//     };

//     try {
//         await fsp.writeFile(`${config.projects.samas.paths.mapproxyConf}/Samas_Sen2Previews.yaml`, mapproxy.getMapproxySeedYamlString(mapproxySeedConf));
//     } catch (e) {
//         console.log(e);
//     }
// }

async function createConfigurationFiles(groupedFiles) {
    await createMapserverConfigurationFile(groupedFiles);
    await createMapproxyConfigurationFile(groupedFiles);
    // await createMapproxySeedConfigurationFile(groupedFiles);
}

async function run() {
    const groupedFiles = await getGroupedFiles();
    const existingGroups = await getExistingGroups();

    if (groupedFiles && Object.keys(groupedFiles).length && Object.keys(groupedFiles).length !== existingGroups.length) {
        await createConfigurationFiles(groupedFiles);
        await setExistingGroups(Object.keys(groupedFiles));

        console.log("#SAMAS# WMS definitions was updated!")
    }
}

run();