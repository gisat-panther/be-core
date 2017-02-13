/**
 * It simply retrieves all the analytical units associated with given base layer references.
 */
class PgAnalyticalUnits {
	constructor(pool) {
		this._pool = pool;
	}

	all(analyticalUnitId) {
		return this._pool.query(`SELECT gid, name, ST_AsText(St_Transform(the_geom, 4326)) FROM views.layer_${analyticalUnitId};`).then(result => {
			return result.rows;
		});
	}
}

module.exports = PgAnalyticalUnits;