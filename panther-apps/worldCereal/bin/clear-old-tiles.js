const axios = require('axios');
const fsp = require('fs/promises');
const path = require('path');

const config = require('../../../config.js');

function getCouchDbHost() {
    return `http://${config.couchdb.user}:${config.couchdb.password}@${config.couchdb.host}:${config.couchdb.port}`;
}

async function getTileIndexes(databases) {
    const content = await fsp.readdir(config.mapproxy.paths.datasource);
    return content.filter((file) => {
        const lowerCaseFileName = file.toLowerCase();
        for (const database of databases) {
            if (lowerCaseFileName.startsWith(database) && file.endsWith(".shp")) {
                return true;
            }
        }
    });
}

async function getTimeIndexes(tileIndexes) {
    let timeIndexes = {};
    for (const tileIndex of tileIndexes) {
        const stats = await fsp.stat(`${config.mapproxy.paths.datasource}/${tileIndex}`);
        timeIndexes[path.parse(tileIndex.toLowerCase()).name] = stats.mtimeMs / 1000;
    }

    return timeIndexes;
}

async function getDatabases() {
    const response = await axios.get(`${getCouchDbHost()}/_all_dbs`);
    let filtered = [];

    if (!config.projects.worldCereal.allowSeed || config.projects.worldCereal.allowSeed === "all") {
        filtered = response.data.filter((dbName) => dbName.startsWith('worldcereal_'));
    } else if (config.projects.worldCereal.allowSeed === "confidence") {
        filtered = response.data.filter((dbName) => dbName.startsWith('worldcereal_') && dbName.endsWith("_confidence"));
    } else if (config.projects.worldCereal.allowSeed === "product") {
        filtered = response.data.filter((dbName) => dbName.startsWith('worldcereal_') && dbName.endsWith("_product"));
    }

    return filtered;
}

async function getOldTiles(database, timeIndex) {
    const response = await axios.post(
        `${getCouchDbHost()}/${database}/_find`,
        {
            selector: {
                timestamp: {
                    "$lt": timeIndex
                }
            },
            fields: ["_id"],
            limit: 100
        }
    )
    return response.data.docs.map((doc) => doc._id);
}

async function createTimestampIndex(database) {
    await axios.post(`${getCouchDbHost()}/${database}/_index`, {
        index: {
            fields: ["timestamp"]
        }
    });
    console.log(`Timestamp index was created in ${database} database`);
}

async function deleteTile(database, tileId) {
    let response = await axios.get(`${getCouchDbHost()}/${database}/${tileId}`);

    const tileRev = response.data._rev;

    response = await axios.delete(`${getCouchDbHost()}/${database}/${tileId}?rev=${tileRev}`);

    if (response.status === 200) {
        return true;
    }
}

async function compactDatabase(database) {
    const response = await axios.post(`${getCouchDbHost()}/${database}/_compact`, {});
    if (response.status === 202) {
        console.log(`Compacting database ${database}`);
    }
}

async function purgeDatabase(database) {
    console.log(`Purging deleted data from database ${database}`);
    while (true) {
        const response = await axios.get(`${getCouchDbHost()}/${database}/_changes`);
        const purge = [];
        for (const result of response.data.results) {
            if (result.deleted) {
                purge.push({
                    [result.id]: result.changes.map((change) => change.rev)
                });
            }
        }

        if (purge.length) {
            const chunkSize = 100;
            for (let i = 0; i < purge.length; i += chunkSize) {
                const chunk = purge.slice(i, i + chunkSize);

                await axios.post(`${getCouchDbHost()}/${database}/_purge`, Object.assign({}, ...chunk))
                process.stdout.write(".");
            }
            process.stdout.write("\n");
        } else {
            break;
        }
    }
}

async function clearOldTiles(databases, timeIndexes) {
    for (const database of databases) {
        const timeIndex = timeIndexes[database];
        console.log(`Deleting tiles older than ${timeIndex} from ${database} database`);

        await createTimestampIndex(database);

        let deletedOldTiles = 0;
        while (true) {
            const oldTiles = await getOldTiles(database, timeIndex);
            if (oldTiles && oldTiles.length) {
                for (const tileId of oldTiles) {
                    const result = await deleteTile(database, tileId);
                    if (result) {
                        deletedOldTiles++;
                    }
                }
                process.stdout.write(".");
            } else {
                if (deletedOldTiles) {
                    process.stdout.write("\n");
                }
                break;
            }
        }

        console.log(`${deletedOldTiles} old tiles was deleted from ${database} database`);

        if (deletedOldTiles) {
            await purgeDatabase(database);
            await compactDatabase(database);
        }

        console.log(`---`);
    }
}

async function run() {
    const databases = await getDatabases();
    const tileIndexes = await getTileIndexes(databases);
    const timeIndexes = await getTimeIndexes(tileIndexes);

    await clearOldTiles(databases, timeIndexes);
}

run();