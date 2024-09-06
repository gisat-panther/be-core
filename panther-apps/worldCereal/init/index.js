const { execSync } = require('child_process');

const config = require('../../../config');

function loadFixtures() {
    try {
        let output = execSync(
            `./bin/load-fixtures-for-application worldCereal`
        ).toString();
        console.log(`#WorldCereal# fixtures`, output);
        return true;
    } catch (e) {
        console.log(`#WorldCereal# fixtures`, error);
        return false;
    }
};

function loadS2Tiles() {
    try {
        let output = execSync(
            `ogr2ogr -f PostgreSQL \
            PG:"\
            dbname='${config.pgConfig.normal.database}' \
            host='${config.pgConfig.normal.host}' \
            port='${config.pgConfig.normal.port || 5432}' \
            user='${config.pgConfig.normal.user}' \
            password='${config.pgConfig.normal.password}'" \
            -overwrite \
            -lco GEOMETRY_NAME=geom \
            ./panther-apps/worldCereal/assets/world_cereal_s2_tiles.gpkg`
        ).toString();
        console.log(`#WorldCereal# s2tiles`, output);
        return true;
    } catch (e) {
        console.log(`#WorldCereal# s2tiles`, error);
        return false;
    }
};

function run() {
    let fixturesResult = loadFixtures();
    let s2TilesResult = loadS2Tiles();

    return {
        fixturesResult,
        s2TilesResult
    }
}

module.exports = {
    loadFixtures,
    loadS2Tiles,
    run
}