const c = require('../../applications/commands');

/**
 * @param {string} group
 * @param {object} request
 * @param {object} request.params
 * @param {object} request.user
 * @param {object} request.body
 *
 * @returns {import('./result').Result}
 */
function list(group, request) {
    return c.get()[group].list.handler(request);
}

/**
 * @param {string} group
 * @param {object} request
 * @param {object} request.user
 * @param {object} request.body
 *
 * @returns {import('./result').Result}
 */
function create(group, request) {
    return c.get()[group].create.handler(request);
}

/**
 * @param {string} group
 * @param {object} request
 * @param {object} request.user
 * @param {object} request.body
 *
 * @returns {import('./result').Result}
 */
function update(group, request) {
    return c.get()[group].update.handler(request);
}

/**
 * @param {string} group
 * @param {object} request
 * @param {object} request.user
 * @param {object} request.body
 *
 * @returns {import('./result').Result}
 */
function deleteRecords(group, request) {
    return c.get()[group].delete.handler(request);
}

module.exports = {
    list,
    create,
    update,
    deleteRecords,
};
