const fsp = require('fs/promises');

async function getFilesAtPathRecursive(path, files = []) {
    try {
        const contentOfDir = await fsp.readdir(path);

        for (const entry of contentOfDir) {
            const entryPath = `${path}/${entry}`;
            const entryStat = await fsp.stat(entryPath);

            if (entryStat.isDirectory()) {
                await getFilesAtPathRecursive(entryPath, files);
            } else {
                files.push(entryPath);
            }
        }
    } catch (e) {

    }

    return files;
}

module.exports = {
    getFilesAtPathRecursive
}