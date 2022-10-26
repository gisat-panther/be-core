const { spawnSync } = require('child_process');
const { pgConfig } = require('../../../config');

async function importLocalSql({ path }) {
    const options = {
        '-h': pgConfig.normal.host,
        '-U': pgConfig.normal.user,
        '-p': pgConfig.normal.port || 5432,
        '-f': `${path}`,
    };

    const args = [...Object.entries(options).flat(), pgConfig.normal.database];

    try {
        spawnSync('psql', args, {
            env: { PATH: process.env.PATH, PGPASSWORD: pgConfig.normal.password },
            stdio: 'inherit',
            shell: true,
        });

        return true;
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    importLocalSql
}