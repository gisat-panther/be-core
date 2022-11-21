const axios = require('axios');

const uuid = require('../../uuid');

const {
    createTempLocation,
    clearTempLocation,
    saveFile,
    importLocal
} = require('./local');

async function importRemote({ file, url, user }) {
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
    } catch(e) {
        error = e;
    }

    if (error) {
        throw error;
    }
}

module.exports = {
    importRemote
}