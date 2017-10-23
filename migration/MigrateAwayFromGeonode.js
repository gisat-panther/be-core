let Migration = require('./Migration');

class MigrateAwayFromGeonode extends Migration{
    constructor(schema, geonodePool) {
        super('MigrateAwayFromGeonode');

        this._schema = schema;
        this._geonodePool = geonodePool;
    }

    process(mongo, pool) {
        return this._geonodePool.query(`SELECT name, typename FROM layers_layer`).then(result => {
            let query = result.rows.map(row => `INSERT INTO ${this._schema}.layers (name, path) VALUES ('${row.name}', '${row.typename}');`).join(' ');

            return pool.query(query);
        });
    }
}

module.exports = MigrateAwayFromGeonode;