const Joi = require('../../joi');
const _ = require('lodash');
const _fp = require('lodash/fp');
const translation = require('./translation');
const customFields = require('./custom-fields');
const schemaUtil = require('./schema-util');

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
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {object}
 */
function listBody(plan, group) {
    const columns = schemaUtil.mergeColumns(
        _.flatMap(plan[group], (s) => {
            const types = _.get(s, ['type', 'types'], {});

            return schemaUtil.mergeColumns(
                _.concat(
                    [s.columns],
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
            filter: schemaUtil.filter(columns),
            order: schemaUtil.order(columns),
            limit: Joi.number().integer().default(100),
            offset: Joi.number().integer().default(0),
        })
        .append(translation.listSchema());
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

                            return Joi.object()
                                .keys({
                                    key: keyCol.schema.default(
                                        keyCol.defaultValue
                                    ),
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
                                        .concat(customFields.schema()),
                                })
                                .append(translation.schema());
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
                            .required()
                            .concat(customFields.schema()),
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
                                        .required()
                                        .concat(customFields.schema()),
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
                        .required()
                        .concat(customFields.schema()),
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
