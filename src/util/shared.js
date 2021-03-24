const cluster = require("cluster");
const ipc = require("node-ipc");
const {v4: uuid} = require("uuid");
const _ = require("lodash");
const fs = require("fs");
const hash = require('object-hash');

const ipcSocketPath = "/tmp/ptr-ipc-master.sock"

const shared = {};

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
		if (!shared[data.key] || shared[data.key].value !== "#processing") {
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
	}, 0);
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
	getHash,
	getUserHash
}