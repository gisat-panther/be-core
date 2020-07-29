const config = require('../../../config');
const db = require('../../db');
const {SQL} = require('sql-template-strings');

const schema = config.pgSchema.user;

/**
 * @param {string} email
 * @param {string} password
 *
 * @returns {Promise<{key: string, password: string}>}
 */
function getUser(email, password) {
    return db
        .query(
            SQL`SELECT "key", "password" FROM`
                .append(` "${schema}"."users" `)
                .append(
                    SQL`WHERE "email" = ${email} AND "password" = crypt(${password}, "password")`
                )
        )
        .then((res) => {
            return res.rows[0];
        });
}

/**
 * @param {string} key
 *
 * @returns {Promise<{email: string, name: string, phone: string}>}
 */
function getUserInfoByKey(key) {
    if (key == null) {
        return;
    }

    return db
        .query(
            SQL`SELECT "email", "name", "phone" FROM`
                .append(` "${schema}"."users" `)
                .append(SQL`WHERE "key" = ${key}`)
        )
        .then((res) => res.rows[0]);
}

/**
 * @param {string} key
 *
 * @returns {Promise<{resourceType: string, permission: string}[]>}
 */
function userPermissionsByKey(key) {
    if (key == null) {
        return [];
    }

    return db
        .query(
            `
SELECT
  "p"."resourceType", "p"."permission"
FROM
  "${schema}"."v_userPermissions" "p"
WHERE
  "p"."resourceKey" IS NULL AND "p"."userKey" = $1
`,
            [key]
        )
        .then((res) => res.rows);
}

module.exports = {
    userPermissionsByKey,
    getUser,
    getUserInfoByKey,
};
