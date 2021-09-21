const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');

function create(request, response) {
    return handler
        .create('user', {
            user: request.user,
            body: {
                data: {
                    users: [request.body]
                }
            }
        })
        .then((r) => {
            if (r.type === result.CREATED) {
                response.status(201).end();
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                response.status(500).end();
            }
        })
        .catch((error) => {
            response.status(500).end();
        })
}

function update(request, response) {
    return handler
        .update('user', {
            user: request.user,
            body: {
                data: {
                    users: [request.body]
                }
            }
        })
        .then((r) => {
            if (r.type === result.UPDATED) {
                response.status(200).end();
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                response.status(500).end();
            }
        })
        .catch((error) => {
            response.status(500).end();
        })
}

function remove(request, response) {
    return handler
        .deleteRecords('user', {
            user: request.user,
            body: {
                data: {
                    users: [request.body]
                }
            }
        })
        .then((r) => {
            if (r.type === result.DELETED) {
                response.status(200).end();
            } else if (r.type === result.FORBIDDEN) {
                response.status(403).end();
            } else {
                response.status(500).end();
            }
        })
        .catch((error) => {
            response.status(500).end();
        })
}

module.exports = {
    create,
    update,
    remove
}