const db = require('./db');
const _ = require('lodash/fp');

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
function get(key) {
    return db
        .query('SELECT "value" FROM "public"."cache" WHERE "key" = $1', [key])
        .then(_.get(['rows', 0, 'value']));
}

/**
 * @param {string} key
 * @param {any} value
 */
function set(key, value) {
    return db
        .query(
            `
INSERT INTO "public"."cache"
  ("key", "value")
VALUES
  ($1, $2)
ON CONFLICT ("key")
DO UPDATE SET "value" = EXCLUDED."value"`,
            [key, JSON.stringify(value)]
        )
        .then(() => null);
}

module.exports = {
    get,
    set,
};
