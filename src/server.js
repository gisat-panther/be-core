const applicationsRouter = require('./applications/index').router;
const config = require('../config');
const db = require('./db');
const migrations = require('./migrations');
const express = require('express');
const permissions = require('./modules/permissions/index');
const getAppConfig = require('./applications/config').get;

const init = async () => {
	try {
		await migrations.migrate();
		await db.init();
		const app = express();
		app.use(applicationsRouter);
		app.listen(config.masterPort, () => {
			console.log(`#NOTE# Master is listening on port ${config.masterPort}`);
		});

		// permissions should ideally run as separate app as described in readme
		const appConfig = getAppConfig();
		await permissions.run({
			plan: appConfig.plan,
			generatedPermissions: appConfig.generatedPermissions
		});
	} catch (error) {
		console.log(`#ERROR#`, error)
		process.exit(1);
	}
}

process.on(`uncaughtException`, (error) => {
	console.log(`#ERROR#`, error);
	process.exit(1);
});

init();
