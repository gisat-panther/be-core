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

async function setGlobal(globalProductKey, productKeys, state, user) {
    const created = new Date().toISOString();
    let productKeysSqlArray = `ARRAY ['${productKeys.join(`', '`)}']::UUID[]`;

    return db.query(
        `INSERT INTO "worldCerealGlobalQueue" (
            "key",
            "productKeys",
            "user",
            "state",
            "time"
        ) VALUES (
            '${globalProductKey}',
            ${productKeysSqlArray},
            '${JSON.stringify(user)}',
            '${state}',
            '${created}'
        ) ON CONFLICT ("key") DO UPDATE SET
            "productKeys" = array(select distinct unnest(array_cat("worldCerealGlobalQueue"."productKeys", ${productKeysSqlArray})))::UUID[],
            "state" = '${state}',
            "time" = '${created}'
        RETURNING *`
    );
}

async function del(productKey) {
    await db.query(`DELETE FROM "worldCerealQueue" WHERE "productKey" = '${productKey}'`);
}

async function delGlobal(globalProductKey) {
    await db.query(`DELETE FROM "worldCerealGlobalQueue" WHERE "key" = '${globalProductKey}'`);
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

async function getNextGlobal() {
    return db.query(
        `SELECT "key" as "globalProductKey", "productKeys", "user" FROM "worldCerealGlobalQueue" WHERE "time" < NOW() - INTERVAL '5 minutes' AND "state" = 'created' ORDER BY "time" LIMIT 1`
    ).then((result) => {
        if (result.rows.length) {
            return result.rows[0];
        } else {
            return {
                globalProductKey: null,
                productKeys: null,
                user: null
            }
        }
    });
}

async function isReady() {
    return db.query(
        `SELECT true as exists FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('worldCerealQueue', 'worldCerealGlobalQueue')`
    ).then((result) => {
        return result.rows.length === 2 && result.rows[0].exists && result.rows[1].exists
    });
}

module.exports = {
    set,
    setGlobal,
    del,
    delGlobal,
    getAll,
    getSettled,
    getNext,
    getNextGlobal,
    isReady
}