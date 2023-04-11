const axios = require('axios');
const uuidByString = require('uuid-by-string');
const path = require('path');

const uuid = require('../../uuid');
const s3Fixtures = require('./s3');
const db = require('./db');

const {
    createTempLocation,
    clearTempLocation,
    saveFile,
    importLocal,
    importLocalFile
} = require('./local');

async function file({ file, url, user }) {
    const processKey = uuid.generate();
    const response = await axios(url, { responseType: "arrayBuffer" });

    let error;

    try {
        await createTempLocation(processKey);

        const localPath = await saveFile({ processKey, name: file, buffer: response.data });

        await importLocal({ file, path: localPath, user });
    } catch (e) {
        error = e;
    }

    try {
        await clearTempLocation(processKey);
    } catch (e) {
        error = e;
    }

    if (error) {
        throw error;
    }
}

async function s3({ s3, user }) {
    const fixturesObjects = await s3Fixtures.getPublicObjects({ ...s3 });
    const errors = [];

    for (const fixturesObject of fixturesObjects) {
        const processKey = uuid.generate();

        const hash = uuidByString(`${fixturesObject.LastModified}-${fixturesObject.Size}`);
        const file = path.parse(fixturesObject.Key).base;

        try {
            if (await db.isFileDifferent({ file, hash })) {
                const response = await axios(`${s3.host}/${fixturesObject.Key}`, { responseType: "arrayBuffer" });

                await createTempLocation(processKey);

                try {
                    const localPath = await saveFile({ processKey, name: file, buffer: response.data });

                    console.log(`#IMPORT# Importing file ${file}`);

                    await importLocalFile({ file, path: localPath, user });
                    await db.saveFileHash({ file, hash });

                    console.log(`#IMPORT# File ${file} was imported`);

                } catch (e) {
                    errors.push(e);
                }

                await clearTempLocation(processKey);
            } else {
                console.log(`#IMPORT# Same version of file ${file} was already imported`);
            }
        } catch (e) {
            errors.push(`${file} - ${e.message}`);
        }
    }

    if (errors.length) {
        throw errors;
    }
}

module.exports = {
    file,
    s3
}