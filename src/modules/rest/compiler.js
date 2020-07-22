const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');

const mapValuesWithKeys = _.mapValues.convert({cap: false});

function compileColumn(column, name) {
    return _.flow(
        _.update('modifyExpr', function (expr) {
            if (expr == null) {
                return ({value}) => qb.val.inlineParam(value);
            }

            return expr;
        }),
        _.update('selectExpr', function (expr) {
            if (expr == null) {
                return ({alias}) => alias + '.' + name;
            }

            return expr;
        })
    )(column);
}

function compileColumns(columns) {
    return mapValuesWithKeys(compileColumn, columns);
}

function compileTypes(types) {
    return _.mapValues(compileType, types);
}

function compileType(type) {
    const withColumns = _.update('columns', compileColumns, type);
    if (type.type == null) {
        return withColumns;
    }

    return _.update(['type', 'types'], compileTypes, withColumns);
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
 * ### selectExpr (optional)
 *   Returns query expression used as a value in list queries.
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
