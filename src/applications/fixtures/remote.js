const axios = require('axios');
const objectHash = require('object-hash');

const uuid = require('../../uuid');
const db = require('./db');

const {
    createTempLocation,
    clearTempLocation,
    saveFile,
    importLocal
} = require('./local');

async function importRemote({ file, url, user }) {
    const processKey = uuid.generate();
    const response = await axios(url, { responseType: "arrayBuffer" });

    try {
        await createTempLocation(processKey);

        const localPath = await saveFile({ processKey, name: file, buffer: response.data });

        await importLocal({ file, path: localPath, user });
    } catch (e) {
        throw e;
    } finally {
        await clearTempLocation(processKey);
    }
}

module.exports = {
    importRemote
}