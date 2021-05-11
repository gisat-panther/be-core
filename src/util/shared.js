const cluster = require("cluster");
const ipc = require("node-ipc");
const {v4: uuid} = require("uuid");
const _ = require("lodash");
const fs = require("fs");
const hash = require('object-hash');
const db = require("../db");

const ipcSocketPath = "/tmp/ptr-ipc-master.sock"

const shared = {};
const execs = {};
const firstGets = {};

ipc.config.silent = true;
// ipc.config.retry = 1500;

const set = (key, value, ttl) => {
	return new Promise((resolve) => {
		let tKey = uuid();
		ipc.config.id = `ptr-be-worker-${cluster.worker.id}`;
		ipc.connectTo(
			tKey,
			ipcSocketPath,
			() => {
				ipc.of[tKey].on("connect", () => {
					// send data to master
					ipc.of[tKey].emit(
						"shared",
						{
							tKey,
							key,
							value,
							method: "set",
							ttl
						}
					)
					// get response from master
					ipc.of[tKey].on(tKey, (data) => {
						if (data.tKey === tKey) {
							ipc.disconnect(tKey);
							resolve(data.done);
						}
					})
				})
			}
		)
	});
}

const _set = (data, socket) => {
	if (data.key && data.value) {
		_.set(shared, data.key, {value: data.value, ttl: data.ttl});
	}

	if (firstGets[data.key]) {
		_.unset(firstGets, data.key);
	}

	ipc.server.emit(
		socket,
		data.tKey,
		{
			...data,
			done: !!(shared[data.key])
		}
	)
}

const get = (key) => {
	return new Promise((resolve) => {
		let tKey = uuid();
		ipc.config.id = `ptr-be-worker-${cluster.worker.id}`;
		ipc.connectTo(
			tKey,
			ipcSocketPath,
			() => {
				ipc.of[tKey].on("connect", () => {
					// ask master for data
					ipc.of[tKey].emit(
						"shared",
						{
							tKey,
							key,
							method: "get"
						}
					)
					// get data from master
					ipc.of[tKey].on(tKey, (data) => {
						if (data.tKey === tKey) {
							ipc.disconnect(tKey);
							resolve(data.value);
						}
					})
				})
			}
		)
	});
}

const _get = (data, socket) => {
	let interval = setInterval(() => {
		if (!firstGets[data.key]) {
			if (!shared[data.key]) {
				firstGets[data.key] = true;
			}
			ipc.server.emit(
				socket,
				data.tKey,
				{
					...data,
					value: shared[data.key] && shared[data.key].value
				}
			)
			clearInterval(interval);
		}
	}, 1);
}

const del = (key) => {
	return new Promise((resolve) => {
		let tKey = uuid();
		ipc.config.id = `ptr-be-worker-${cluster.worker.id}`;
		ipc.connectTo(
			tKey,
			ipcSocketPath,
			() => {
				ipc.of[tKey].on("connect", () => {
					// ask master to delete data
					ipc.of[tKey].emit(
						"shared",
						{
							tKey,
							key,
							method: "del"
						}
					)
					// get response from master
					ipc.of[tKey].on(tKey, (data) => {
						if (data.tKey === tKey) {
							ipc.disconnect(tKey);
							resolve(data.done);
						}
					})
				})
			}
		)
	});
}

const _del = (data, socket) => {
	if (data.key) {
		_.unset(shared, data.key);
	}
	ipc.server.emit(
		socket,
		data.tKey,
		{
			...data,
			done: !(shared[data.key])
		}
	)
}

const exec = (data) => {
	return new Promise((resolve) => {
		let tKey = uuid();
		ipc.config.id = `ptr-be-worker-${cluster.worker.id}`;
		ipc.connectTo(
			tKey,
			ipcSocketPath,
			() => {
				ipc.of[tKey].on("connect", () => {
					// ask master for data
					ipc.of[tKey].emit(
						"shared",
						{
							tKey,
							data,
							method: "exec"
						}
					)
					// get data from master
					ipc.of[tKey].on(tKey, (data) => {
						if (data.tKey === tKey) {
							ipc.disconnect(tKey);
							resolve();
						}
					})
				})
			}
		)
	});
}

const _exec = (data, socket) => {
	execute(data);
	let interval = setInterval(() => {
		if (execs[data.data.key].done) {
			ipc.server.emit(
				socket,
				data.tKey,
				{
					...execs[data.data.key],
					tKey: data.tKey
				}
			)
			clearInterval(interval);
		}
	}, 1);
}

const request = (data, socket) => {
	switch (data.method) {
		case "get":
			_get(data, socket);
			break;
		case "set":
			_set(data, socket);
			break;
		case "del":
			_del(data, socket);
			break;
		case "exec":
			_exec(data, socket);
			break;
	}
}

const execute = (data) => {
	if (!execs[data.data.key]) {
		execs[data.data.key] = data;
	}

	if (!execs[data.data.key].done && !execs[data.data.key].active && data.data.type === "pg") {
		execs[data.data.key].active = true;

		db
			.query(data.data.query.strings.join())
			.then((pgResult) => {
				execs[data.data.key].done = true;
			})
			.catch((error) => {
				execs[data.data.key].done = true;
				execs[data.data.key].error = error.message;
			})
	}
}

const registerWorkerEvents = () => {
	_.each(cluster.workers, (worker) => {
		worker.on("message", (tKey, action, key, value, ttl) => {
			worker.send([tKey, "value"]);
		})
	})
}

const maintenance = () => {
	setInterval(() => {
		_.each(shared, (data, key) => {
			if (data.ttl && data.ttl < Date.now()) {
				_.unset(shared, key);
			}
		})
	}, 1000);
}

const getHash = (...args) => {
	return hash({
		...args
	});
}

const getUserHash = (user) => {
	if (user.type === "guest") {
		return hash(user.type);
	} else {
		return hash(user);
	}
}

const initIpc = () => {
	if (cluster.isMaster) {
		if (fs.existsSync(ipcSocketPath)) {
			fs.unlinkSync(ipcSocketPath);
		}

		ipc.config.id = "ptr-be-master"
		ipc.serve(
			ipcSocketPath,
			() => {
				ipc.server.on(
					"shared",
					request
				)
			})
		ipc.server.start();
	}
}

const init = () => {
	initIpc();
	maintenance();
	registerWorkerEvents();
}

module.exports = {
	init,
	get,
	set,
	del,
	exec,
	getHash,
	getUserHash
}