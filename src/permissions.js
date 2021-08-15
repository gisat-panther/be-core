const permissions = require('./modules/permissions/index');
const db = require('./db');
const migrations = require('./migrations');

const getAppConfig = require('./applications/config').get;

async function init() {
    const appConfig = getAppConfig();

    await migrations.migrate();
    await db.init();
    await permissions.run({
        plan: appConfig.plan,
        generatedPermissions: appConfig.generatedPermissions
    });
}

process.on(`uncaughtException`, (error) => {
	console.log(`#ERROR#`, error)
});

init();
