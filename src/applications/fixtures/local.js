const fsp = require('fs/promises');
const p = require('path');
const objectHash = require('object-hash');
const { spawnSync, execSync } = require('child_process');

const db = require('./db');
const restHandler = require('../../modules/rest/handler');
const restResult = require('../../modules/rest/result');

const { pgConfig } = require('../../../config');

async function importSql({ path, user }) {
    if (!user || user.type !== "user") {
        throw new Error("insufficient permissions");
    }

    const options = {
        '-h': pgConfig.normal.host,
        '-U': pgConfig.normal.user,
        '-p': pgConfig.normal.port || 5432,
        '-f': `${path}`,
    };

    const args = [...Object.entries(options).flat(), pgConfig.normal.database];

    spawnSync('psql', args, {
        env: { PATH: process.env.PATH, PGPASSWORD: pgConfig.normal.password },
        stdio: 'inherit',
        shell: true,
    });

    return true;
}

async function importMetadata({ file, path, user }) {
    const metadata = JSON.parse(await fsp.readFile(path));

    for (const group of Object.keys(metadata)) {
        for (const type of Object.keys(metadata[group])) {
            const chunkSize = 100;
            for (let i = 0; i < metadata[group][type].length; i += chunkSize) {
                let records = metadata[group][type].slice(i, i + chunkSize);
                const updateResult = await restHandler.update(group, { user, body: { data: { [type]: records } } });
                if (updateResult.type === restResult.FORBIDDEN || updateResult.type === restResult.BAD_REQUEST) {
                    throw new Error(`${updateResult.type} - ${group} - ${type}`);
                }
            }
        }
    }

    return "done";
}

async function importJSON({ file, path, user }) {
    if (!user || user.type !== "user") {
        throw new Error("insufficient permissions");
    }

    const isMetadata = file.toLowerCase().startsWith('fixtures');
    if (isMetadata) {
        return await importMetadata({ file, path, user });
    } else {
        throw new Error("unknown json format");
    }
}

async function importGeoJSON({ path, user }) {
    if (!user || user.type !== "user") {
        throw new Error("insufficient permissions");
    }

    const parsedPath = p.parse(path);
    const name = parsedPath.name;

    await db.clearExistingLayer({ name });

    const { host, user: pgUser, password, database, port = 5432 } = pgConfig.normal;
    execSync(
        `ogr2ogr -f "PostgreSQL" "PG:host=${host} user=${pgUser} password=${password} dbname=${database} port=${port}" -overwrite -nln ${name} -lco NAME=${name} -nlt PROMOTE_TO_MULTI -lco SPATIAL_INDEX=GIST -lco GEOMETRY_NAME=geom -lco LAUNDER=NO ${path}`,
        {
            stdio: "ignore"
        }
    )
}

async function getHash(path) {
    const buffer = await fsp.readFile(path);
    return objectHash.MD5(buffer);
}

function getFileType({ file }) {
    switch (p.parse(file).ext.toLowerCase()) {
        case ".sql":
            return "SQL";
        case ".json":
            return "JSON";
        case ".geojson":
            return "GeoJSON";
        case ".zip":
            return "ZIP";
    }
}

async function importLocalFile({ file, path, user }) {
    const fileType = getFileType({ file });
    switch (fileType) {
        case "SQL":
            return importSql({ path, user });
        case "JSON":
            return importJSON({ file, path, user });
        case "GeoJSON":
            return importGeoJSON({ path, user });
        default:
            throw new Error("unknow file type");
    }
}

async function importLocal({ file, path, user }) {
    const hash = await getHash(path);

    const isDifferent = await db.isFileDifferent({ file, hash });
    if (isDifferent) {
        const result = await importLocalFile({ file, path, user });
        await db.saveFileHash({ file, hash });

        return result;
    }
}

async function createTempLocation(processKey) {
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

module.exports = {
    importLocal,
    importLocalFile,
    getFileType,
    createTempLocation,
    clearTempLocation,
    saveFile
}