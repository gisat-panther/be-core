const redis = require('redis');

const config = require('../../../config');

let client;
let localStorage = {};

function init() {
    if (!client) {
        let testClient = redis.createClient(config.redisConfig);

        testClient.on("connect", () => {
            client = testClient;
        });

        testClient.on("error", () => {
            client = undefined;
        });
    }
}

function get(key) {
    return new Promise((resolve, reject) => {
        if (client) {
            client.get(key, (error, value) => {
                if (error) {
                    resolve();
                } else {
                    resolve(value ? JSON.parse(value) : value);
                }
            });
        } else {
            resolve(localStorage[key])
        }
    })
}

function set(key, value) {
    return new Promise((resolve, reject) => {
        if (client) {
            client.set(key, JSON.stringify(value), 'EX', 60 * 60 * 24, (error) => {
                if (error) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else {
            localStorage[key] = value;
            resolve(true);
        }
    })
}

function watch(key) {
    return new Promise((resolve, reject) => {
        if (client) {
            client.watch(key, (error) => {
                if (error) {
                    reject();
                } else {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    })
}

function setMulti(key, value) {
    return new Promise((resolve, reject) => {
        if (client) {
            client
            .multi()
            .set(key, JSON.stringify(value), 'EX', 60 * 60 * 24)
            .exec((error, result) => {
                if (error === null && result !== null) {
                    resolve(true)
                } else {
                    resolve(false);
                }
            });
        } else {
            localStorage[key] = value;
            resolve(true);
        }
    })
}

init();

module.exports = {
    get,
    set,
    watch,
    setMulti
}