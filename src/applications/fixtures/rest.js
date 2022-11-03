const fsp = require('fs/promises');

const uuid = require('../../uuid');
const { getFileType, importLocal } = require('./local');

async function createTemplocation(processKey) {
    return fsp.mkdir(`/tmp/${processKey}`);
}

async function clearTempLocation(processKey) {
    return fsp.rm(`/tmp/${processKey}`, { force: true, recursive: true });
}

async function saveFile({ processKey, name, buffer }) {
    const path = `/tmp/${processKey}/${name}`;

    await fsp.writeFile(path, buffer);

    return path;
}

async function importFixtures(request, response) {
    if (!request.files || !request.files.length) {
        return response.status(500).send("no files found");
    }

    const status = {
        processKey: uuid.generate(),
        files: []
    }

    try {
        await createTemplocation(status.processKey);
        status.tempCreated = true;
    } catch (e) {
        status.tempCreated = false;
        status.tempCreatedError = e.message;
    }

    let failed = false;

    for (const file of request.files) {
        let fileStatus, fileError, localPath;
        const type = getFileType({ file: file.originalname });

        try {
            localPath = await saveFile({ processKey: status.processKey, name: file.originalname, buffer: file.buffer });
            fileStatus = await importLocal({ file: file.originalname, path: localPath, user: request.user });
        } catch (e) {
            fileStatus = "error";
            fileError = e.message;
            failed = true;
        }

        status.files.push({
            file: file.originalname,
            tempPath: localPath,
            type,
            size: file.size,
            status: fileStatus,
            error: fileError
        })
    }

    try {
        await clearTempLocation(status.processKey);
        status.tempRemoved = true;
    } catch (e) {
        status.tempRemoved = false;
        status.tempRemovedError = e.message;
        failed = true;
    }

    return response.status(failed ? 500 : 200).send(status);
}

module.exports = {
    importFixtures
}