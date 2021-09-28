const redis = require('redis');
const client = redis.createClient();

function get(key) {
    return new Promise((resolve, reject) => {
        client.get(key, (error, value) => {
            if (error) {
                resolve();
            } else {
                resolve(value ? JSON.parse(value) : value);
            }
        })
    })
}

function set(key, value) {
    return new Promise((resolve, reject) => {
        client.set(key, JSON.stringify(value), 'EX', 60 * 60 * 24, (error) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}

function watch(key) {
    return new Promise((resolve, reject) => {
        client.watch(key, (error) => {
            if (error) {
                reject();
            } else {
                resolve();
            }
        })
    })
}

function setMulti(key, value) {
    return new Promise((resolve, reject) => {
        client
            .multi()
            .set(key, JSON.stringify(value), 'EX', 60 * 60 * 24)
            .exec((error, result) => {
                if (error === null && result !== null) {
                    resolve(true)
                } else {
                    resolve(false);
                }
            })
    })
}

module.exports = {
    get,
    set,
    watch,
    setMulti
}