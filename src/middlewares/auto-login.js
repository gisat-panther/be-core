const auth = require('../modules/login/auth');
const uuid = require('../uuid');

const GUEST_KEY = 'cad8ea0d-f95e-43c1-b162-0704bfc1d3f6';

const UserType = {
    USER: 'user',
    GUEST: 'guest',
};

/**
 * If no user is logged in, logs in guest user.
 */
async function autoLoginMiddleware(request, response, next) {
    if (request.user != null) {
        return next();
    }

    const user = {
        key: uuid.generate(),
        type: UserType.GUEST,
        realKey: GUEST_KEY,
    };
    const token = await auth.createAuthToken(auth.tokenPayload(user));

    request.user = user;
    request.authToken = token;
    next();
}

module.exports = autoLoginMiddleware;
