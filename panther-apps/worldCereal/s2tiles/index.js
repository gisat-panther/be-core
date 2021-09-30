const db = require('../../../src/db');

function getTilesByBbox(bbox) {
    return db
        .query(`SELECT "tile" FROM "world_cereal_s2_tiles" WHERE geom && ST_GeomFromGeoJSON('${JSON.stringify(bbox)}');`)
        .then((pgResult) => {
            return pgResult.rows.map((row) => row.tile);
        })
}

function getTilesAll() {
    return db
        .query(`SELECT "tile" FROM "world_cereal_s2_tiles";`)
        .then((pgResult) => {
            return pgResult.rows.map((row) => row.tile);
        })
}

module.exports = {
    getTilesByBbox,
    getTilesAll
}