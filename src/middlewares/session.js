const cache = require('../cache');

function cacheKey(user) {
    return 'user:' + user.key;
}

/**
 * This middleware should be after `user` middleware.
 */
async function sessionMiddleware(request, response, next) {
    const user = request.user;
    if (user == null) {
        return;
    }

    request.session = await cache.get(cacheKey(user));
    response.storeSession = (session) => {
        return cache.set(cacheKey(user), session);
    };

    return next();
}

module.exports = sessionMiddleware;
