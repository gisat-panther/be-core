const config = require('../config');
const Memcached = require('memcached');

const cache = new Memcached(
    config.memcached.location,
    config.memcached.options
);

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
function get(key) {
    return new Promise((resolve, reject) => {
        cache.get(key, function (err, data) {
            if (err != null) {
                return reject(err);
            }

            resolve(data);
        });
    });
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} lifetime
 */
function set(key, value, lifetime) {
    return new Promise((resolve, reject) => {
        cache.set(key, value, lifetime, function (err) {
            if (err != null) {
                return reject(err);
            }

            resolve();
        });
    });
}

module.exports = {
    get,
    set,
};
