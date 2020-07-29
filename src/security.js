const config = require('../config');
const db = require('./db');
const {SQL} = require('sql-template-strings');

db.init();

/**
 * @param {string} password
 *
 * @returns {Promise<string>}
 */
function hashPassword(password) {
    return db
        .query(
            SQL`SELECT crypt(${password}, gen_salt('bf', ${config.password.iteration_counts})) AS password`
        )
        .then((result) => result.rows[0].password);
}

module.exports = {
    hashPassword,
};
