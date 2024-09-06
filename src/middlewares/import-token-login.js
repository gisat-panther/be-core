const auth = require('../modules/login/auth');
const uuid = require('../uuid');
const q = require('../modules/login/query');

const UserType = {
    USER: 'user'
};

/**
 * If no user is logged in, logs in user by Import-Token header.
 */
async function importTokenLogin(request, response, next) {
    if (request.user != null) {
        return next();
    }

    const importToken = request.headers['import-token'];
    if (!importToken) {
        return next();
    }

    let importTokenDecoded;
    try {
        importTokenDecoded = JSON.parse(Buffer.from(importToken, 'base64'));
    } catch(e) {
        return next();
    }

    if (!uuid.isValid(importTokenDecoded.userKey)) {
        return next();
    }

    if (!await q.getUserInfoByKey(importTokenDecoded.userKey)) {
        return next();
    }

    const user = {
        key: importTokenDecoded.userKey,
        type: UserType.USER,
        realKey: importTokenDecoded.userKey
    };

    const token = await auth.createAuthToken(
        auth.tokenPayload(user)
    );

    request.user = user;
    request.authToken = token;
    next();
}

module.exports = importTokenLogin;
