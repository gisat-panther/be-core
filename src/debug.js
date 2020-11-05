const _ = require('lodash/fp');

/**
 * @param {any} val
 *
 * @returns {any}
 */
function prepareVal(val) {
    switch (typeof val) {
        case 'string':
            return `'${val}'`;
        default:
            return val;
    }
}

/**
 * @param {object} sqlStatement
 * @param {string[]} sqlStatement.strings
 * @param {any[]} slStatement.values
 *
 * @returns {string}
 */
function formatSql(sqlStatement) {
    const preparedVals = _.map(prepareVal, sqlStatement.values);

    return _.reduce(
        (inlined, next) => {
            return inlined + preparedVals.pop() + next;
        },
        _.head(sqlStatement.strings),
        _.tail(sqlStatement.strings)
    );
}

module.exports = {
    formatSql,
};
