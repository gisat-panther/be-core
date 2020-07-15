const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');

function compileColumn(column) {
    if (column.modifyExpr === undefined) {
        return _.set(
            'modifyExpr',
            ({value}) => qb.val.inlineParam(value),
            column
        );
    }

    return column;
}

function compileColumns(columns) {
    return _.mapValues(compileColumn, columns);
}

function compileType(type) {
    return _.update('columns', compileColumns, type);
}

function compileGroup(group) {
    return _.mapValues(compileType, group);
}

/**
 * Plan of individual types is stored under <group>.<type>.
 *
 * ## table (optional)
 *
 * Table name in case it differs from type name.
 *
 * ## columns
 *
 * ### schema (required)
 *   Joi schema (https://hapi.dev/module/joi/api/). `.required()` should not be used as it is added automatically based on context.
 *
 * ### defaultValue (optional)
 *   Default value if none was provided (https://hapi.dev/module/joi/api/#anydefaultvalue).
 *
 * ### modifyExpr (optional)
 *   Returns query expression used as a value in create and update queries.
 *
 * ## relations
 *
 * ## context (required)
 *
 * Configuration for specific operations. Supported operations are: `list`, `create`, `update`.
 *
 * ### columns (required)
 *
 * Allowed columns during this operation.
 */
function compile(plan) {
    return _.mapValues(compileGroup, plan);
}

module.exports = {
    compile,
};
