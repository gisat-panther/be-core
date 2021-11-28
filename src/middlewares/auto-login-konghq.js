const auth = require('../modules/login/auth');
const uuid = require('../uuid');
const q = require('../modules/login/query');
const config = require('../../config');

const UserType = {
    USER: 'user'
};

const worldCerealUserKeyMap = {
    "0000": "a7365eb7-e986-4660-8eed-3dd3a6350024"
}

/**
 * If no user is logged in, logs in user by X-User-Info header provided by KongHQ.
 */
async function autoLoginKongHqMiddleware(request, response, next) {
    if (!config.isBehindKong) {
        return next();
    }

    if (request.user != null) {
        return next();
    }

    let kongUserKey = request.headers['x-user-info'];

    // TODO This is just quick fix and has to be removed in next phase
    if (worldCerealUserKeyMap.hasOwnProperty(kongUserKey)) {
        console.log(`#WARNING# Invalid UUID ${kongUserKey} was replaced with proper one! This has to be solved!`);
        kongUserKey = worldCerealUserKeyMap[kongUserKey];
    }

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
