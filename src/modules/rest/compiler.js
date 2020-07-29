const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');

/**
 * @typedef {Object} Context
 * @property {{columns: string[]}} list
 * @property {{columns: string[]}} create
 * @property {{columns: string[]}} update
 *
 * @typedef {Object} Column
 * @property defaultValue
 * @property {object} schema
 * @property {import('@imatic/pgqb').Value} selectExpr
 * @property {import('@imatic/pgqb').Value} modifyExpr
 *
 * @typedef {Object} Relation
 * @property {'manyToOne'|'manyToMany'} type
 * @property {string} relationTable
 * @property {string} ownKey
 * @property {string} inverseKey
 * @property {string} resourceGroup
 * @property {string} resourceType
 *
 * @typedef {Object} TypeType
 * @property {string} dispatchColumn
 * @property {string} key
 * @property {Object<string, {context: Object<string, Context>, columns: Object<string, Column>}>} types
 *
 * @typedef {Object} Type
 * @property {string} table
 * @property {Context} context
 * @property {Object<string, Column>} columns
 * @property {Object<string, Relation>} relations
 *
 * @typedef {Object<string, Type>} Group
 *
 * @typedef {Object<string, Group>} Plan
 */

const mapValuesWithKeys = _.mapValues.convert({cap: false});

/**
 * @returns {Column}
 */
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

/**
 * @returns {Object<string, Column>}
 */
function compileColumns(columns) {
    return mapValuesWithKeys(compileColumn, columns);
}

/**
 * @returns {Object<string, TypeType>}
 */
function compileTypes(types) {
    return _.mapValues(compileType, types);
}

/**
 * @returns {Type}
 */
function compileType(type) {
    const withColumns = _.update('columns', compileColumns, type);
    if (type.type == null) {
        return withColumns;
    }

    return _.update(['type', 'types'], compileTypes, withColumns);
}

/**
 * @returns {Group}
 */
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
 * ## type (optional)
 *
 * Adds support for many types inside of this type. Each type can have it's own additional set of columns.
 *
 * ### dispatchColumn (required)
 *
 * Column name that decided of which type given record is.
 *
 * ### key (required)
 *
 * Db column that stores type of type specific table table.
 *
 * ### types (required)
 *
 * Map with type as key. Value is map with supported keys: columns, context, that are merged into based type.
 *
 * ## relations (optional)
 *
 * ## context (required)
 *
 * Configuration for specific operations. Supported operations are: `list`, `create`, `update`.
 *
 * ### columns (required)
 *
 * Allowed columns during this operation.
 *
 * @returns {Plan}
 */
function compile(plan) {
    return _.mapValues(compileGroup, plan);
}

module.exports = {
    compile,
};
