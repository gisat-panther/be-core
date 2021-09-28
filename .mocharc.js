const {assert, expect} = require('chai');

/**
 * @template T
 *
 * @param {Set<T>} s
 *
 * @returns {Array<T>}
 */
function convertSet(s) {
    s = Array.from(s);
    s.sort();

    return s;
}

// patch deepStrictEqual to show nice diff instead of two empty objects for sets
const deepStrictEqual = assert.deepStrictEqual;
assert.deepStrictEqual = function (actual, expected, ...more) {
    if (actual instanceof Set && expected instanceof Set) {
        actual = convertSet(actual);
        expected = convertSet(expected);
    }

    return deepStrictEqual(actual, expected, ...more);
};

const config = {
};

module.exports = config;
