const config = require('../../../config');
const jwt = require('jsonwebtoken');

/**
 * @param {Object} payload
 * @param {String} payload.key Key from database in case `type` is `user` or random in case `type` is `guest`
 * @param {String} payload.realKey Key from database
 * @param {String} payload.type `guest` or `user`
 *
 * @returns {Object} Payload
 */
function tokenPayload({key, type, realKey}) {
    return {key, type, realKey};
}

/**
 * @param {Object} payload
 * @param {String} payload.key Key from database in case `type` is `user` or random in case `type` is `guest`
 * @param {String} payload.realKey Key from database
 * @param {String} payload.type `guest` or `user`
 *
 * @returns Promise
 */
function createAuthToken(payload) {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            config.jwt.secret,
            {expiresIn: config.jwt.expiresIn},
            function (err, token) {
                if (err == null) {
                    return resolve(token);
                }

                reject(err);
            }
        );
    });
}

module.exports = {
    tokenPayload,
    createAuthToken,
};
