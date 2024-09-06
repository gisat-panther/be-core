const auth = require('../modules/login/auth');
const uuid = require('../uuid');
const q = require('../modules/login/query');
const config = require('../../config');

const UserType = {
    USER: 'user'
};

/**
 * If no user is logged in, logs in user by x-userinfo header provided by KongHQ.
 */
async function autoLoginKongHqMiddleware(request, response, next) {
    if (!config.isBehindKong) {
        return next();
    }

    if (request.user != null) {
        return next();
    }

    const xUserInfo = request.headers['x-userinfo'];
    if (!xUserInfo) {
        return next();
    }

    let xUserInfoDecoded;
    try {
        xUserInfoDecoded = JSON.parse(Buffer.from(xUserInfo, 'base64'));
    } catch(e) {
        return next();
    }

    if (!uuid.isValid(xUserInfoDecoded.userid)) {
        return next();
    }

    if (!await q.getUserInfoByKey(xUserInfoDecoded.userid)) {
        return next();
    }

    const user = {
        key: xUserInfoDecoded.userid,
        type: UserType.USER,
        realKey: xUserInfoDecoded.userid
    };

    const token = await auth.createAuthToken(
        auth.tokenPayload(user)
    );

    request.user = user;
    request.authToken = token;
    next();
}

module.exports = autoLoginKongHqMiddleware;
