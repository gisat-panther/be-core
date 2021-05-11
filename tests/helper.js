const db = require('../src/db');

const PERMISSION_RELATIONS_ATTRIBUTE_CREATE =
    '5609b0da-6fac-4b47-ab88-b12f97114bdf';
const PERMISSION_RELATIONS_ATTRIBUTE_UPDATE =
    '10061997-2e64-4dd9-b645-28eb5f937f65';
const PERMISSION_RELATIONS_ATTRIBUTE_VIEW =
    '4f617ffb-86ff-4f38-84b6-ea016afcbaa3';
const PERMISSION_RELATIONS_ATTRIBUTE_DELETE =
    '0585eda7-de9e-4aab-8f47-1c1085804054';

const PERMISSION_METADATA_CASE_VIEW = 'ed6a9cb0-7662-4d85-bb9a-ed5b78396008';

const PERMISSION_METADATA_SCOPE_VIEW = 'a307e381-8c12-4d0e-9934-0d739cce7fa2';

const PERMISSION_METADATA_PLACE_VIEW = 'd221213b-a956-43b6-989e-32b73bee90f6';

const PERMISSION_METADATA_PERIOD_VIEW = '0cc99d81-8038-49a0-8f3a-b5bd55b94513';

let changes = {0: []};
let changesIndex = 0;

/**
 * Switch to new scope (revert won't affect previous changes, until `prevScope` is called).
 */
function newScope() {
    changesIndex++;
    changes[changesIndex] = [];
}

/**
 * Switch to previous scope.
 */
function prevScope() {
    delete changes[changesIndex];
    changesIndex--;
}

/**
 * Push change to current scope.
 *
 * @param {array} change
 */
function pushChange(change) {
    changes[changesIndex].push(change);
}

/**
 * @param {string} permissionKey
 * @param {string} hashKey
 */
function removeHashPermission(permissionKey, hashKey) {
    return db.query(
        `DELETE FROM "user"."hashPermissions" WHERE "hashKey" = $1 AND "permissionKey" = $2`,
        [hashKey, permissionKey]
    );
}

/**
 * @param {string} permissionKey
 * @param {string} hashKey
 */
async function grantHashPermission(permissionKey, hashKey) {
    pushChange([removeHashPermission, permissionKey, hashKey]);

    return db.query(
        `
INSERT INTO "user"."hashPermissions"
  ("hashKey", "permissionKey")
VALUES
  ($1, $2)`,
        [hashKey, permissionKey]
    );
}

/**
 * @param {string[]} permissionKeys
 * @param {string} hashKey
 */
async function grantHashPermissions(permissionKeys, hashKey) {
    permissionKeys.forEach((p) => {
        pushChange([removeHashPermission, p, hashKey]);
    });

    await Promise.all(
        permissionKeys.map((p) => grantHashPermission(p, hashKey))
    );
}

/**
 * @param {string} permissionKey
 * @param {string} userKey
 */
function removePermission(permissionKey, userKey) {
    return db.query(
        `DELETE FROM "user"."userPermissions" WHERE "userKey" = $1 AND "permissionKey" = $2`,
        [userKey, permissionKey]
    );
}

/**
 * @param {string} permissionKey
 * @param {string} userKey
 */
async function grantPermission(permissionKey, userKey) {
    pushChange([removePermission, permissionKey, userKey]);

    return db.query(
        `
INSERT INTO "user"."userPermissions"
  ("userKey", "permissionKey")
VALUES
  ($1, $2)`,
        [userKey, permissionKey]
    );
}

/**
 * @param {string[]} permissionKeys
 * @param {string} userKey
 */
async function grantPermissions(permissionKeys, userKey) {
    permissionKeys.forEach((p) => {
        pushChange([removePermission, p, userKey]);
    });

    await Promise.all(permissionKeys.map((p) => grantPermission(p, userKey)));
}

/**
 * @param {string} table
 * @param {string} key
 */
async function removeRecord(table, key) {
    return db.query(`DELETE FROM ${table} WHERE "key" = $1`, [key]);
}

/**
 * @param {string} table
 * @param {object} columns
 */
async function createRecord(table, columns) {
    pushChange([removeRecord, table, columns.key]);

    const entries = Object.entries(columns);
    const colNames = entries.map(([col]) => `"${col}"`).join(', ');
    const values = entries.map((v, k) => `$${k + 1}`).join(', ');

    return db.query(
        `INSERT INTO ${table}(${colNames}) VALUES (${values}) RETURNING "key"`,
        entries.map(([, v]) => v)
    );
}

/**
 * @param {object} columns
 */
async function removeTranslation(columns) {
    return db.query(
        `
DELETE FROM
  "public"."translations"
WHERE
  "resourceKey" = $1
  AND "resourceGroup" = $2
  AND "resourceType" = $3
  AND "locale" = $4
  AND "field" = $5`,
        [
            columns.resourceKey,
            columns.resourceGroup,
            columns.resourceType,
            columns.locale,
            columns.field,
        ]
    );
}

/**
 * @param {object} columns
 */
async function createTranslation(columns) {
    pushChange([removeTranslation, columns]);

    return db.query(
        `
INSERT INTO
  "public"."translations"("resourceKey", "resourceGroup", "resourceType", "locale", "field", "value")
VALUES
  ($1, $2, $3, $4, $5, $6)`,
        [
            columns.resourceKey,
            columns.resourceGroup,
            columns.resourceType,
            columns.locale,
            columns.field,
            columns.value,
        ]
    );
}

/**
 * Reverts all changes made by functions in this module.
 */
async function revertChanges() {
    // return;
    for (const change of changes[changesIndex].reverse()) {
        await change[0].apply(null, change.splice(1));
    }

    changes[changesIndex] = [];
}

module.exports = {
    newScope,
    prevScope,
    createRecord,
    createTranslation,
    grantPermission,
    grantPermissions,
    grantHashPermission,
    grantHashPermissions,
    revertChanges,
    PERMISSION_RELATIONS_ATTRIBUTE_CREATE,
    PERMISSION_RELATIONS_ATTRIBUTE_DELETE,
    PERMISSION_RELATIONS_ATTRIBUTE_UPDATE,
    PERMISSION_RELATIONS_ATTRIBUTE_VIEW,
    PERMISSION_METADATA_CASE_VIEW,
    PERMISSION_METADATA_PERIOD_VIEW,
    PERMISSION_METADATA_PLACE_VIEW,
    PERMISSION_METADATA_SCOPE_VIEW,
};
