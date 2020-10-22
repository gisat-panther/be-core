const Joi = require('../../joi');
const _ = require('lodash');
const _fp = require('lodash/fp');
const translation = require('./translation');

/**
 * @param {import('./compiler').Column} col
 *
 * @returns {object|null}
 */
function colFilterSchema(col) {
    const type = _fp.get(['schema', 'type'], col);
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
                ..._.get(schema, ['$_terms', 'items'])
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
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function listPath(plan, group) {
    const types = Object.keys(plan[group]);

    return Joi.object()
        .required()
        .keys({
            types: Joi.stringArray()
                .items(Joi.string().valid(...types))
                .min(1),
        });
}

/**
 * Since we can use one filter for many types and many types can have same columns,
 * we need to make sure that given filter is valid for all types.
 */
function mergeColumns(columns) {
    const merged = {};

    _.forEach(columns, function (cols) {
        _.forEach(cols, function (col, name) {
            const existing = merged[name];
            if (existing) {
                col = Object.assign({}, existing, {
                    schema: existing.schema.concat(col.schema),
                });
            }

            merged[name] = col;
        });
    });

    return merged;
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function listBody(plan, group) {
    const columns = mergeColumns(
        _.flatMap(plan[group], (s) => {
            const types = _.get(s, ['type', 'types'], {});

            return mergeColumns(
                _.concat(
                    s.columns,
                    _.map(types, (t) => t.columns),
                    _.reduce(
                        _.keys(s.relations),
                        (columns, name) => {
                            const rel = s.relations[name];
                            switch (rel.type) {
                                case 'manyToMany':
                                    columns[name + 'Keys'] = {
                                        schema: Joi.array().items(
                                            plan[rel.resourceGroup][
                                                rel.resourceType
                                            ].columns.key.schema
                                        ),
                                    };

                                    return columns;
                                case 'manyToOne':
                                    columns[name + 'Key'] = {
                                        schema: plan[rel.resourceGroup][
                                            rel.resourceType
                                        ].columns.key.schema.allow(null),
                                    };

                                    return columns;
                            }

                            throw new Error(
                                `Unspported relation type: ${rel.type}`
                            );
                        },
                        {}
                    )
                )
            );
        })
    );

    return Joi.object()
        .meta({className: `${group}List`})
        .keys({
            filter: Joi.object()
                .keys(_.omitBy(_.mapValues(columns, colFilterSchema), _.isNil))
                .allow(null),
            order: Joi.array()
                .items(
                    Joi.array()
                        .length(2)
                        .items(
                            Joi.string()
                                .valid(...Object.keys(columns))
                                .required(),
                            Joi.string()
                                .required()
                                .valid('ascending', 'descending')
                        )
                )
                .allow(null)
                .default([]),
            limit: Joi.number().integer().default(100),
            offset: Joi.number().integer().default(0),
        });
}

/**
 * @param {import('./compiler').Column} col
 *
 * @returns {object}
 */
function dataColCreateSchema(col) {
    if (col.hasOwnProperty('defaultValue')) {
        return col.schema.default(col.defaultValue);
    }

    return col.schema.required();
}

/**
 * @param {Plan} plan
 * @param {string} group
 * @param {string} type
 *
 * @returns {object}
 */
function relationSchemas(plan, group, type) {
    const relations = plan[group][type].relations;
    const relationSchemas = {};
    _.forEach(relations, function (rel, name) {
        switch (rel.type) {
            case 'manyToMany':
                relationSchemas[name + 'Keys'] = Joi.array().items(
                    plan[rel.resourceGroup][rel.resourceType].columns.key.schema
                );
                return;
            case 'manyToOne':
                relationSchemas[name + 'Key'] = plan[rel.resourceGroup][
                    rel.resourceType
                ].columns.key.schema.allow(null);
                return;
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    });

    return relationSchemas;
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function createBody(plan, group) {
    const dataKeys = _.mapValues(plan[group], function (typeSchema, type) {
        if (typeSchema.type != null) {
            const validTypes = Array.from(
                typeSchema.columns[typeSchema.type.dispatchColumn].schema
                    ._valids._values
            );

            return Joi.array()
                .items(
                    Joi.alternatives().try(
                        ..._.map(validTypes, (currentType) => {
                            const columns = _.merge(
                                {},
                                _.pick(
                                    _fp.update(
                                        [
                                            typeSchema.type.dispatchColumn,
                                            'schema',
                                        ],
                                        function (schema) {
                                            return schema.valid(
                                                Joi.override,
                                                currentType
                                            );
                                        },
                                        typeSchema.columns
                                    ),
                                    typeSchema.context.create.columns
                                ),
                                _.pick(
                                    _.get(
                                        typeSchema,
                                        [
                                            'type',
                                            'types',
                                            currentType,
                                            'columns',
                                        ],
                                        {}
                                    ),
                                    _.get(
                                        typeSchema,
                                        [
                                            'type',
                                            'types',
                                            currentType,
                                            'context',
                                            'create',
                                            'columns',
                                        ],
                                        []
                                    )
                                )
                            );

                            const keyCol = columns.key;
                            const dataCols = _.omit(columns, ['key']);

                            const rs = relationSchemas(plan, group, type);

                            return Joi.object().keys({
                                key: keyCol.schema.default(keyCol.defaultValue),
                                data: Joi.object()
                                    .keys(
                                        Object.assign(
                                            {},
                                            _.mapValues(
                                                dataCols,
                                                dataColCreateSchema
                                            ),
                                            rs
                                        )
                                    )
                                    .required()
                                    .append(translation.schema()),
                            });
                        })
                    )
                )
                .min(1);
        }

        const columns = _.pick(
            typeSchema.columns,
            typeSchema.context.create.columns
        );

        const keyCol = columns.key;
        const dataCols = _.omit(columns, ['key']);

        const rs = relationSchemas(plan, group, type);

        return Joi.array()
            .items(
                Joi.object()
                    .keys({
                        key: keyCol.schema.default(keyCol.defaultValue),
                        data: Joi.object()
                            .keys(
                                Object.assign(
                                    {},
                                    _.mapValues(dataCols, dataColCreateSchema),
                                    rs
                                )
                            )
                            .required(),
                    })
                    .append(translation.schema())
            )
            .min(1);
    });

    return Joi.object()
        .meta({className: `${group}Create`})
        .required()
        .keys({
            data: Joi.object().required().min(1).keys(dataKeys).min(1),
        });
}

/**
 * @param {import('./compiler').Column} col
 *
 * @returns {object}
 */
function dataColUpdateSchema(col) {
    return col.schema;
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function updateBody(plan, group) {
    const dataKeys = _.mapValues(plan[group], function (typeSchema, type) {
        if (typeSchema.type != null) {
            const validTypes = Array.from(
                typeSchema.columns[typeSchema.type.dispatchColumn].schema
                    ._valids._values
            );

            return Joi.array()
                .items(
                    Joi.alternatives().try(
                        ..._.map(validTypes, (currentType) => {
                            const columns = _.merge(
                                {},
                                _.pick(
                                    _fp.update(
                                        [
                                            typeSchema.type.dispatchColumn,
                                            'schema',
                                        ],
                                        function (schema) {
                                            return schema.valid(
                                                Joi.override,
                                                currentType
                                            );
                                        },
                                        typeSchema.columns
                                    ),
                                    typeSchema.context.create.columns
                                ),
                                _.pick(
                                    _.get(
                                        typeSchema,
                                        [
                                            'type',
                                            'types',
                                            currentType,
                                            'columns',
                                        ],
                                        {}
                                    ),
                                    _.get(
                                        typeSchema,
                                        [
                                            'type',
                                            'types',
                                            currentType,
                                            'context',
                                            'create',
                                            'columns',
                                        ],
                                        []
                                    )
                                )
                            );

                            const keyCol = columns.key;
                            const dataCols = _.omit(columns, ['key']);

                            const rs = relationSchemas(plan, group, type);

                            return Joi.object()
                                .keys({
                                    key: keyCol.schema.required(),
                                    data: Joi.object()
                                        .keys(
                                            Object.assign(
                                                {},
                                                _.mapValues(
                                                    dataCols,
                                                    dataColUpdateSchema
                                                ),
                                                rs
                                            )
                                        )
                                        .required(),
                                })
                                .append(translation.schema());
                        })
                    )
                )
                .min(1);
        }

        const columns = _.pick(
            typeSchema.columns,
            typeSchema.context.update.columns
        );

        const keyCol = columns.key;
        const dataCols = _.omit(columns, ['key']);

        const rs = relationSchemas(plan, group, type);

        return Joi.array().items(
            Joi.object()
                .keys({
                    key: keyCol.schema.required(),
                    data: Joi.object()
                        .keys(
                            Object.assign(
                                {},
                                _.mapValues(dataCols, dataColUpdateSchema),
                                rs
                            )
                        )
                        .required(),
                })
                .min(1)
                .append(translation.schema())
        );
    });

    return Joi.object()
        .meta({className: `${group}Update`})
        .required()
        .keys({
            data: Joi.object().required().min(1).keys(dataKeys),
        });
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function deleteBody(plan, group) {
    const dataKeys = _.mapValues(plan[group], function (typeSchema) {
        const columns = typeSchema.columns;
        const keyCol = columns.key;

        return Joi.array()
            .min(1)
            .items(
                Joi.object().keys({
                    key: keyCol.schema.required(),
                })
            );
    });

    return Joi.object()
        .meta({className: `${group}Delete`})
        .required()
        .keys({
            data: Joi.object().required().min(1).keys(dataKeys),
        });
}

module.exports = {
    listPath,
    listBody,
    createBody,
    updateBody,
    deleteBody,
};
