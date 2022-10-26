const fsp = require('fs/promises');
const path = require('path');
const objectHash = require('object-hash');

const db = require('./db');
const localSql = require('./localSql');

async function getHash(path) {
    const buffer = await fsp.readFile(path);
    return objectHash.MD5(buffer);
}

function getFileType({file}) {
    switch(path.parse(file).ext.toLowerCase()) {
        case ".sql":
            return "SQL";
    }
}

async function importLocalFile({file, path}) {
    const fileType = getFileType({file});
    switch(fileType) {
        case "SQL":
            return localSql.importLocalSql({path})
    }
}

async function importLocal({ file, path }) {
    const hash = await getHash(path);
    const isDifferent = await db.isFileDifferent({file, hash});
    if (isDifferent) {
        const imported = importLocalFile({file, path});
        if (imported) {
            await db.saveFileHash({file, hash});
        } else {
            console.log(`#WorldCereal# Failed to import ${file}`);
        }
    } else {
        console.log(`#WorldCereal# File ${file} was already imported. Skipped!`);
    }
}

module.exports = {
    importLocal
}