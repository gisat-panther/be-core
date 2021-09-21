const uuidByString = require('uuid-by-string');

const result = require('../../../src/modules/rest/result');
const handler = require('../../../src/modules/rest/handler');

function getKeyByProductId(productMetadata) {
    return uuidByString(productMetadata.id)
}

function create(request, response) {
    return handler
        .create('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId(request.body),
                            data: {
                                data: request.body
                            }
                        }
                    ]
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
        .update('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId(request.body),
                            data: {
                                data: request.body
                            }
                        }
                    ]
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
        .deleteRecords('specific', {
            user: request.user,
            body: {
                data: {
                    worldCerealProductMetadata: [
                        {
                            key: getKeyByProductId(request.body)
                        }
                    ]
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

function view(request, response) {
    return handler
        .list('specific', {
            params: { types: 'worldCerealProductMetadata' },
            user: request.user,
            body: {
                filter: request.body
            }
        })
        .then((r) => {
            if (r.type === result.SUCCESS) {
                response.status(200).send(
                    r.data.data.worldCerealProductMetadata.map(
                        (product) => Object.assign({}, product, { permissions: undefined })
                    )
                );
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
    remove,
    view
}