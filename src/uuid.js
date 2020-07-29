const uuid = require('uuid').v1;

/**
 * @returns {string}
 */
function generate() {
    return uuid();
}

module.exports = {
    generate,
};
