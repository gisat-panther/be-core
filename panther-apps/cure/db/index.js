const db = require('../../../src/db.js');

async function saveUserOrder(user, app, order) {
    const orderStr = JSON.stringify(order);

    const result = await db.query(
        `INSERT INTO "cureUserOrders" (
            "userKey",
            "orderId",
            "app",
            "status",
            "result"
        ) VALUES (
            '${user.realKey}',
            '${order.order_id}',
            '${app}',
            '${order.status}',
            '${orderStr}'
        ) ON CONFLICT (
            "userKey", 
            "orderId"
        ) DO UPDATE SET 
            "status" = '${order.status}',
            "result" = '${orderStr}'
        RETURNING "key", "orderId", "app", "status", "result"->>'result' AS "result", "result"->>'expiration' AS "expiration", created;
        `
    );

    if (result.rows.length) {
        return result.rows[0];
    }
}

async function getUserOrders(userKey) {
    const result = await db.query(
        `SELECT "key", "orderId", "app", "status", "result"->>'result' AS "result", "result"->>'expiration' AS "expiration", created FROM "cureUserOrders" WHERE "userKey" = '${userKey}'`
    );

    return result.rows;
}

async function getAllOrders() {
    const result = await db.query(
        `SELECT "key", "userKey", "orderId", "app", "status", "result"->>'result' AS "result", "result"->>'expiration' AS "expiration", created FROM "cureUserOrders"`
    );

    return result.rows;
}

async function createUser(email, password) {
    try {
        const result = await db.query(
            `INSERT INTO "user"."users" (
                "email",
                "password"
            ) VALUES (
                '${email}',
                '${password}'
            ) RETURNING "key"`
        );
    
        return result.rows[0] && result.rows[0].key;
    } catch(e) {

    }
}

async function assingUserToGroups(userKey, groupKeys) {
    try {
        const result = await db.query(
            `INSERT INTO "user"."userGroups" (
                "userKey", "groupKey"
            ) VALUES ${groupKeys.map((groupKey) => `('${userKey}', '${groupKey}')`).join(', ')}`
        )

        return !!(result.rowCount)
    } catch(e) {

    }
}

async function init() {
    await db.init();
}

module.exports = {
    saveUserOrder,
    getUserOrders,
    getAllOrders,
    createUser,
    assingUserToGroups,
    init
}