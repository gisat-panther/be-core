const _ = require('lodash/fp');
const Joi = require('../../joi');

const foreachWithKey = _.forEach.convert({cap: false});

/**
 * Since we can use one filter for many types and many types can have same columns,
 * we need to make sure that given filter is valid for all types.
 *
 * @param {Object<string, {schema: import('../../joi').Root}>[]} columns
 */
function mergeColumns(columns) {
    const merged = {};

    _.forEach(function (cols) {
        foreachWithKey(function (col, name) {
            const existing = merged[name];
            if (existing) {
                col = Object.assign({}, existing, {
                    schema: existing.schema.concat(col.schema),
                });
            }

            merged[name] = col;
        }, cols);
    }, columns);

    return merged;
}

function schemaType(schema) {
    for (const meta of _.getOr([], ['$_terms', 'metas'], schema)) {
        if (typeof meta === 'object' && meta.hasOwnProperty('type')) {
            return meta.type;
        }
    }
}

function objectColSchema(schema) {
    switch (schemaType(schema)) {
        case 'geometry':
            return Joi.object().keys({
                geometry_overlaps: schema,
                st_intersects: schema,
            });
    }
}

/**
 * @param {import('./compiler').Column} col
 *
 * @returns {object|null}
 */
function colFilterSchema(col) {
    const type = _.get(['schema', 'type'], col);
    if (type == null) {
        return null;
    }

    const schema = col.schema;
    switch (type) {
        case 'string':
            return Joi.alternatives().try(
                schema,
                Joi.object()
                    .keys({
                        like: schema,
                        eq: schema,
                        in: Joi.array().items(schema.allow(null)).min(1),
                        notin: Joi.array().items(schema.allow(null)).min(1),
                    })
                    .length(1)
            );
        case 'isoDuration':
            return Joi.object()
                .keys({
                    overlaps: schema,
                })
                .length(1);
        case 'number':
            return Joi.alternatives().try(
                schema,
                Joi.object()
                    .keys({
                        eq: schema,
                        in: Joi.array().items(schema.allow(null)).min(1),
                        notin: Joi.array().items(schema.allow(null)).min(1),
                    })
                    .length(1)
            );
        case 'date':
            return Joi.alternatives().try(
                schema,
                Joi.object()
                    .keys({
                        eq: schema,
                        timefrom: schema,
                        timeto: schema,
                        in: Joi.array().items(schema.allow(null)).min(1),
                        notin: Joi.array().items(schema.allow(null)).min(1),
                    })
                    .length(1)
            );
        case 'object':
            return objectColSchema(schema);
        case 'array': {
            const itemSchema = Joi.alternatives().try(
                ..._.get(['$_terms', 'items'], schema)
            );

            return Joi.object().keys({
                eq: itemSchema,
                in: Joi.array().items(itemSchema.allow(null)).min(1),
                notin: Joi.array().items(itemSchema.allow(null)).min(1),
                overlaps: Joi.array().items(itemSchema).min(1),
            });
        }
        case 'boolean': {
            return Joi.alternatives().try(Joi.boolean());
        }
    }

    throw new Error(`Type "${type}" is not supported in filter.`);
}

/**
 * @param {object} Schema
 * @param {{defaultFilter: any}=} context
 *
 * @returns {object}
 */
function setDefaultFilterValue(Schema, context) {
    if (!_.has('defaultFilter', context)) {
        return Schema;
    }

    return Schema.default(_.get('defaultFilter', context));
}

/**
 * @param {Object<string, {type: import('joi').Root}>} columns
 * @param {{defaultFilter: any}=} context
 *
 * @returns {import('joi').Root}
 */
function filter(columns, context) {
    const Schema = Joi.object()
        .keys(_.omitBy(_.isNil, _.mapValues(colFilterSchema, columns)))
        .allow(null);

    return setDefaultFilterValue(Schema, context);
}

/**
 * @param {Object<string, {type: import('joi').Root}>} columns
 *
 * @returns {import('joi').Root}
 */
function order(columns) {
    return Joi.array()
        .items(
            Joi.array()
                .length(2)
                .items(
                    Joi.string()
                        .valid(...Object.keys(columns))
                        .required(),
                    Joi.string().required().valid('ascending', 'descending')
                )
        )
        .allow(null)
        .default([]);
}

module.exports = {
    mergeColumns,
    filter,
    order,
};
