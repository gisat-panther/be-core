const applicationsRouter = require('./applications/index').router;
const config = require('../config');
const db = require('./db');
const migrations = require('./migrations');
const express = require('express');

const init = async () => {
	try {
		await migrations.migrate();
		await db.init();
		const app = express();
		app.use(applicationsRouter);
		app.listen(config.masterPort, () => {
			console.log(`#NOTE# Master is listening on port ${config.masterPort}`);
		});
	} catch (error) {
		console.log(`#ERROR#`, error)
	}
}

process.on(`uncaughtException`, (error) => {
	console.log(`#ERROR#`, error)
});

init();
