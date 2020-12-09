const {Pool, Client, types} = require('pg');
const hstore = require('pg-hstore')();
const config = require('../config');

const ADVISORY_LOCK_PERMISSIONS = 1;

let pool;

/**
 * @param {import('pg').Client} client
 *
 * @returns {Promise}
 */
async function obtainPermissionsLock(client) {
    await client.query('SELECT pg_advisory_lock($1)', [
        ADVISORY_LOCK_PERMISSIONS,
    ]);
}

/**
 * @param {import('pg').Client} client
 *
 * @returns {Promise}
 */
async function releasePermissionsLock(client) {
    await client.query('SELECT pg_advisory_unlock($1)', [
        ADVISORY_LOCK_PERMISSIONS,
    ]);
}

/**
 * @callback Transactional
 * @param {TransactionalCallback} cb
 * @returns {Promise}
 *
 * @callback SetUser
 * @param {string|null} user
 * @returns {Promise}
 *
 * @typedef ClientExtension
 * @property {Transactional} transactional
 * @property {SetUser} setUser
 *
 * @typedef {import('pg').Client & ClientExtension} Client
 *
 * @callback TransactionalCallback
 * @param {Client} client
 */

/**
 * Puts query into the pool to be executed by free connection
 */
function query(queryTextOrConfig, values) {
    return pool.query(queryTextOrConfig, values);
}

/**
 * Sets user for current transaction. This user will be shown in audit.
 *
 * @param {Client} client
 * @param {string|null} user
 */
async function setUser(client, user) {
    await client.query("SELECT SET_CONFIG('app.user', $1, true)", [user]);
}

/**
 * @returns {import('pg')}
 */
function connect() {
    return pool.connect();
}

/**
 * @callback TransactionCallback
 * @param {import('pg').Client} client
 * @returns {Promise}
 */

/**
 * Executes callback within transaction started at given client.
 *
 * @param {import('pg').Client} client
 * @param {TransactionCallback} cb
 *
 * @returns {Promise}
 */
async function transaction(client, cb) {
    try {
        await client.query('BEGIN');
        const result = await cb(client);
        await client.query('COMMIT');

        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

/**
 * Get exclusive client to execute queries with (nobody else can use it at the same time).
 * Runs all queries in transaction.
 *
 * @param {TransactionalCallback} cb
 */
async function transactional(cb) {
    const client = await pool.connect();
    client.transactional = async function (cb) {
        return cb(client);
    };
    client.setUser = function (user) {
        return setUser(client, user);
    };

    try {
        await client.query('BEGIN');
        const result = await cb(client);
        await client.query('COMMIT');
        client.release();

        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        client.release(err);
        throw err;
    }
}

/**
 * @returns {import('pg').Client}
 */
function getSuperUserClient() {
    return new Client(config.pgConfig.superuser || config.pgConfig.normal);
}

function hstoreOid() {
    return query(`SELECT oid FROM "pg_type" WHERE "typname" = 'hstore'`).then(
        (res) => res.rows[0].oid
    );
}

function parseHstore(res) {
    let r = null;
    hstore.parse(res, (parsed) => {
        r = parsed;
    });

    return r;
}

async function init() {
    if (pool != null) {
        return;
    }

    pool = new Pool(config.pgConfig.normal);
    types.setTypeParser(await hstoreOid(), parseHstore);
}

module.exports = {
    init,
    query,
    connect,
    obtainPermissionsLock,
    releasePermissionsLock,
    transaction,
    transactional,
    getSuperUserClient,
};
