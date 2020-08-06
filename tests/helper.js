const db = require('../src/db');

const PERMISSION_RELATIONS_ATTRIBUTE_CREATE =
    '5609b0da-6fac-4b47-ab88-b12f97114bdf';
const PERMISSION_RELATIONS_ATTRIBUTE_UPDATE =
    '10061997-2e64-4dd9-b645-28eb5f937f65';
const PERMISSION_RELATIONS_ATTRIBUTE_VIEW =
    '4f617ffb-86ff-4f38-84b6-ea016afcbaa3';
const PERMISSION_RELATIONS_ATTRIBUTE_DELETE =
    '0585eda7-de9e-4aab-8f47-1c1085804054';

let changes = [];

function removePermission(permissionKey, userKey) {
    return db.query(
        `DELETE FROM "user"."userPermissions" WHERE "userKey" = $1 AND "permissionKey" = $2`,
        [userKey, permissionKey]
    );
}

async function grantPermission(permissionKey, userKey) {
    changes.push([removePermission, permissionKey, userKey]);

    return db.query(
        `
INSERT INTO "user"."userPermissions"
  ("userKey", "permissionKey")
VALUES
  ($1, $2)`,
        [userKey, permissionKey]
    );
}

async function grantPermissions(permissionKeys, userKey) {
    permissionKeys.forEach((p) => {
        changes.push([removePermission, p, userKey]);
    });

    await Promise.all(permissionKeys.map((p) => grantPermission(p, userKey)));
}

async function removeRecord(table, key) {
    return db.query(`DELETE FROM ${table} WHERE "key" = $1`, [key]);
}

async function createRecord(table, columns) {
    changes.push([removeRecord, table, columns.key]);

    const entries = Object.entries(columns);
    const colNames = entries.map(([col]) => `"${col}"`).join(', ');
    const values = entries.map((v, k) => `$${k + 1}`).join(', ');

    return db.query(
        `INSERT INTO ${table}(${colNames}) VALUES (${values}) RETURNING "key"`,
        entries.map(([, v]) => v)
    );
}

async function revertChanges() {
    for (const change of changes.reverse()) {
        await change[0].apply(null, change.splice(1));
    }

    changes = [];
}

module.exports = {
    createRecord,
    grantPermission,
    grantPermissions,
    revertChanges,
    PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
    PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
    PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
    PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
};
