const uuid = require('uuid').v1;
const { validate } = require('uuid');

/**
 * @returns {string}
 */
function generate() {
    return uuid();
}

function isValid(string) {
    return validate(string);
}

module.exports = {
    generate,
    isValid
};
