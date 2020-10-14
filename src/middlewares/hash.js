/**
 * Enriches user with hash if present.
 */
function hashMiddleware(request, response, next) {
    if (request.user == null) {
        return next();
    }

    const hash = request.headers.hash;
    if (hash == null) {
        return next();
    }

    request.user.hash = hash;
    next();
}

module.exports = hashMiddleware;
