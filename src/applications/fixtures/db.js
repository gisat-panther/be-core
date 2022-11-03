const db = require('../../db');

async function isFileDifferent({ file, hash }) {
    return db
        .query(`SELECT COUNT(*)::int FROM "fixtures" WHERE "file" = '${file}' AND "hash" = '${hash}';`)
        .then((result) => {
            if (result.rows[0].count) {
                throw new Error("File was already processed!");
            } else {
                return true;
            }
        })
}

async function saveFileHash({ file, hash }) {
    return db
        .query(`INSERT INTO "fixtures" ("file", "hash") VALUES ('${file}', '${hash}')`);
}

module.exports = {
    isFileDifferent,
    saveFileHash
}