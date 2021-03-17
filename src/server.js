const cluster = require('cluster');
const applicationsRouter = require('./applications/index').router;
const config = require('../config');
const db = require('./db');
const shared = require("../src/util/shared");
const migrations = require('./migrations');
const permissions = require('./modules/permissions/index');
const getAppConfig = require('./applications/config').get;
const prometheus = require('./modules/prometheus/index');
const express = require('express');

const initMaster = async () => {
	try {
		await migrations.migrate();
		initWorkers()
		shared.init();
		await db.init();
		const appConfig = getAppConfig();
		const app = express();
		prometheus.init({app});
		permissions.run({
			plan: appConfig.plan,
			generatedPermissions: appConfig.generatedPermissions
		});
		app.listen(config.masterPort, () => {
			console.log(`#NOTE# Master is listening on port ${config.masterPort}`);
		});
	} catch (error) {
		console.log(`#ERROR#`, error)
	}
}

const initWorkers = () => {
	const os = require('os');
	const cpuCount = os.cpus().length;
	const workersCount = Math.min(cpuCount, config.clusterPorts.length);

	for(let i = 0; i < workersCount; i++) {
		let port = config.clusterPorts[i];
		createWorker({port});
	}
}

const initWorker = async () => {
	await db.init();
	const app = express();
	prometheus.init({app});
	app.use(applicationsRouter);
	app.listen(process.env.port, () => {
		console.log(`#NOTE# Cluster worker id ${cluster.worker.id} is listening on port ${process.env.port}`);
	});
}

const createWorker = (env) => {
	let worker = cluster.fork(env);
	worker.process.env = env;

	if(config.keepAliveWorkers) {
		worker.on("exit", () => {
			console.log(`#NOTE# Worker ${worker.id} died`);
			createWorker(env);
		})
	}
}

process.on(`uncaughtException`, (error) => {
	console.log(`#ERROR#`, error)
});

if(cluster.isMaster) {
	initMaster();
} else {
	initWorker();
}
