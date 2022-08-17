const db = require('../../../src/db');

async function set(productKey, state, user) {
    const created = new Date().toISOString();
    return db.query(
        `INSERT INTO "worldCerealQueue" (
            "productKey",
            "user",
            "state",
            "time"
        ) VALUES (
            '${productKey}',
            '${JSON.stringify(user)}',
            '${state}',
            '${created}'
        ) ON CONFLICT ("productKey") DO UPDATE SET
            "state" = '${state}',
            "time" = '${created}'
        RETURNING *`
    )
}

async function del(productKey) {
    await db.query(`DELETE FROM "worldCerealQueue" WHERE "productKey" = '${productKey}'`);
}

async function getAll() {
    return db.query(
        `SELECT "productKey", "user" FROM "worldCerealQueue"`
    ).then((result) => result.rows);
}

async function getSettled() {
    return db.query(
        `SELECT "productKey", "user" FROM "worldCerealQueue" WHERE "time" < NOW() - INTERVAL '60 minutes'`
    ).then((result) => result.rows);
}

async function getNext() {
    return db.query(
        `SELECT "productKey", "user" FROM "worldCerealQueue" WHERE "time" < NOW() - INTERVAL '60 minutes' AND "state" = 'created' ORDER BY "time" LIMIT 1`
    ).then((result) => {
        if (result.rows.length) {
            return result.rows[0];
        } else {
            return {
                productKey: null,
                user: null
            }
        }
    });
}

async function isReady() {
    return db.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'worldCerealQueue'
        )`
    ).then((result) => result.rows[0].exists);
}

module.exports = {
    set,
    del,
    getAll,
    getSettled,
    getNext,
    isReady
}