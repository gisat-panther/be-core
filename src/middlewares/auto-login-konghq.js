const auth = require('../modules/login/auth');
const uuid = require('../uuid');
const q = require('../modules/login/query');

const UserType = {
    USER: 'user'
};

/**
 * If no user is logged in, logs in user by X-User-Info header provided by KongHQ.
 */
async function autoLoginKongHqMiddleware(request, response, next) {
    if (request.user != null) {
        return next();
    }

    const kongUserKey = request.headers['x-user-info'];

    if (!uuid.isValid(kongUserKey)) {
        return next();
    }

    if (!await q.getUserInfoByKey(kongUserKey)) {
        return next();
    }

    const user = {
        key: kongUserKey,
        type: UserType.USER,
        realKey: kongUserKey
    };

    const token = await auth.createAuthToken(
        auth.tokenPayload(user)
    );

    request.user = user;
    request.authToken = token;
    next();
}

module.exports = autoLoginKongHqMiddleware;
