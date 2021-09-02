const config = require('../config');
const db = require('./db');
const Postgrator = require('postgrator');

async function ensureNormalDb() {
    const pgClient = db.getNormalUserClient();
    await pgClient.connect();
    await pgClient.query('CREATE EXTENSION IF NOT EXISTS hstore;')
    await pgClient.end();
}

async function ensureDb() {
    if (!config.pgConfig.superuser) {
        await ensureNormalDb();
        return;
    }

    const pgClient = db.getSuperUserClient();
    await pgClient.connect();
    await pgClient
        .query(`CREATE ROLE "${config.pgConfig.normal.user}"`)
        .catch((error) => {
            console.log(`#WARNING#`, error.message);
        });

    await pgClient
        .query(
            `ALTER ROLE "${config.pgConfig.normal.user}" PASSWORD '${config.pgConfig.normal.password}'`
        )
        .catch((error) => {
            console.log(`#WARNING#`, error.message);
        });

    await pgClient
        .query(`ALTER ROLE "${config.pgConfig.normal.user}" LOGIN`)
        .catch((error) => {
            console.log(`#WARNING#`, error.message);
        });

    await pgClient
        .query(`ALTER ROLE "${config.pgConfig.normal.user}" SUPERUSER`)
        .catch((error) => {
            console.log(`#WARNING#`, error.message);
        });
    await pgClient
        .query(`CREATE DATABASE "panther" WITH OWNER "panther";`)
        .catch((error) => {
            console.log(`#WARNING#`, error.message);
        });

    await pgClient.end();
    await ensureNormalDb();
}

function createPostgrator() {
    const normalConfig = config.pgConfig.normal;

    return new Postgrator({
        migrationDirectory: __dirname + '/../migrations',
        driver: 'pg',
        host: normalConfig.host,
        port: normalConfig.port,
        database: normalConfig.database,
        username: normalConfig.user,
        password: normalConfig.password,
        schemaTable: 'public.schemaversion',
    });
}

/**
 * Runs migrations up or down so that db is at version `version`.
 *
 * @param {number|'max'} version
 */
async function migrate(version = 'max') {
    await ensureDb();
    await db.init();
    const client = await db.connect();
    await db.obtainMigrationsLock(client);
    try {
        const appliedMigrations = await createPostgrator().migrate(version);
        if (appliedMigrations.length > 0) {
            console.log(appliedMigrations);
        }
    } finally {
        await db.releaseMigrationsLock(client);
    }
    client.release();
}

module.exports = {
    migrate,
};
