const _ = require('lodash/fp');
const Joi = require('../../joi');

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
            return null;
        case 'array':
            const itemSchema = Joi.alternatives().try(
                ..._.get(['$_terms', 'items'], schema)
            );

            return Joi.object().keys({
                eq: itemSchema,
                in: Joi.array().items(itemSchema.allow(null)).min(1),
                notin: Joi.array().items(itemSchema.allow(null)).min(1),
            });
    }

    throw new Error(`Type "${type}" is not supported in filter.`);
}

/**
 * @param {Object<string, {type: import('joi').Root}>} columns
 *
 * @returns {import('joi').Root}
 */
function filter(columns) {
    return Joi.object()
        .keys(_.omitBy(_.isNil, _.mapValues(colFilterSchema, columns)))
        .allow(null);
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
    filter,
    order,
};
