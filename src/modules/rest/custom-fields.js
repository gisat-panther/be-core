const Joi = require('../../joi');
const qb = require('@imatic/pgqb');
const _ = require('lodash/fp');
const {SQL} = require('sql-template-strings');
const set = require('../../set');
const db = require('../../db');
const schemaUtil = require('./schema-util');
const {HttpError} = require('../error');
const apiUtil = require('../../util/api');

const mapWithKey = _.map.convert({cap: false});
const mapValuesWithKey = _.mapValues.convert({cap: false});

/**
 * @typedef {{type: string}} CustomField
 *
 * @typedef {Object<string, CustomField>} CustomFields
 */

/**
 * @returns {object}
 */
function schema() {
    return Joi.object().unknown(true);
}

/**
 * @param {string} alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listQuery(alias) {
    return qb.select([`${alias}.__customColumns`]);
}

/**
 * @param {{customFields: {all: CustomFields}}} context
 * @param {{alias: string, field: string}} field
 *
 * @returns {import('@imatic/pgqb').Expr | null}
 */
function fieldExpr({customFields}, {alias, field}) {
    const f = _.get(['all', field], customFields);
    if (f == null) {
        return null;
    }

    const dbType = columnDbType(customFieldToColumn(f));

    return qb.val.raw(
        `("${alias}"."__customColumns" ->> '${field}')::${dbType}`
    );
}

/**
 * @param {{customFields: {all: CustomFields}}} context
 * @param {{alias: string, field: string, order: string}} field
 *
 * @returns {import('@imatic/pgqb').Sql | null}
 */
function sortExpr({customFields}, {alias, field, order}) {
    const fe = fieldExpr({customFields}, {alias, field});
    if (fe == null) {
        return null;
    }

    return qb.orderBy(fe, order === 'ascending' ? 'ASC' : 'DESC');
}

/**
 * @param {{plan: string, group: string, type: string}} context
 *
 * @returns {string[]}
 */
function validDataNames({plan, group, type}) {
    const typeSchema = plan[group][type];

    return _.uniq(
        _.reduce(
            _.concat,
            [],
            [
                Object.keys(_.getOr({}, 'columns', typeSchema)),
                mapWithKey((rel, name) => {
                    switch (rel.type) {
                        case 'manyToMany':
                            return name + 'Keys';
                        case 'manyToOne':
                            return name + 'Key';
                    }

                    throw new Error(`Unspported relation type: ${rel.type}`);
                }, _.getOr({}, 'relations', typeSchema)),
                _.flatMap(
                    (type) => Object.keys(_.getOr([], 'columns', type)),
                    _.getOr({}, ['type', 'types'], typeSchema)
                ),
            ]
        )
    );
}

/**
 * @param {{plan: string, group: string}} context
 *
 * @returns {Set<string>}
 */
function validGroupDataNames({plan, group}) {
    const types = Object.keys(plan[group]);

    return new Set(
        _.flatMap((type) => validDataNames({plan, group, type}), types)
    );
}

/**
 * @param {{plan: string, group: string, type: string}} context
 * @param {object[]} records
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function create({plan, group, type}, records) {
    const validNames = validDataNames({plan, group, type});
    const values = _.map(
        (record) => [
            qb.val.inlineParam(
                JSON.stringify(_.omit(validNames, record.data)),
                records
            ),
        ],
        records
    );

    return qb.merge(qb.columns(['__customColumns']), qb.values(values));
}

/**
 * @param {{plan: string, group: string, type: string}} context
 * @param {object} record
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function update({plan, group, type}, record) {
    const validNames = validDataNames({plan, group, type});
    const value = JSON.stringify(_.omit(validNames, record.data));

    return qb.set([
        qb.expr.eq(
            '__customColumns',
            qb.val.raw(SQL`("__customColumns" || ${value}::jsonb)`)
        ),
    ]);
}

/**
 * @param {object} row
 *
 * @return {object}
 */
function formatRow(row) {
    const customColumns = _.getOr({}, ['data', '__customColumns'], row);

    return _.update(
        'data',
        _.flow(_.omit('__customColumns'), _.merge(customColumns)),
        row
    );
}

/**
 * @param {object} record
 *
 * @returns {object[]}
 */
function extractRecordFieldMaps(record) {
    const translations = _.getOr({}, 'translations', record);

    return [
        _.getOr({}, 'data', record),
        ..._.map((fields) => fields, translations),
    ];
}

/**
 * @param {object} record
 *
 * @returns {Set<string>}
 */
function extractRecordFields(record) {
    return _.flow(
        extractRecordFieldMaps,
        _.mergeAll,
        Object.keys,
        set.from
    )(record);
}

/**
 * @param {object} data
 *
 * @returns {Set<string>}
 */
function extractFields(data) {
    return _.flow(
        _.flatMap((records) => records),
        _.reduce(
            (fields, record) => set.union(fields, extractRecordFields(record)),
            set.from()
        )
    )(data);
}

/**
 * @param {string} v1
 * @param {string} v2
 *
 * @returns {string}
 */
function mergeTypes(v1, v2) {
    if (v1 == null) {
        return v2;
    }

    if (v2 == null) {
        return v1;
    }

    if (v1 === v2) {
        return v1;
    }

    throw new Error(`Cannot merge type ${v1} with ${v2}.`);
}

/**
 * @param {string[]} fields
 * @param {object} record
 *
 * @return {CustomFields}
 */
function inferRecordFieldTypes(fields, record) {
    return _.flow(
        extractRecordFieldMaps,
        _.map((m) => _.mapValues(inferType, _.pick(fields, m))),
        _.mergeAllWith(mergeTypes)
    )(record);
}

/**
 * @param {Set<string>} unknownCustomFields
 * @param {object} data
 *
 * @returns {CustomFields}
 */
function inferFieldTypes(unknownCustomFields, data) {
    const fields = Array.from(unknownCustomFields);

    return _.flow(
        _.flatMap((records) =>
            _.map((record) => inferRecordFieldTypes(fields, record), records)
        ),
        _.mergeAllWith(mergeTypes),
        _.mapValues((type) => ({type}))
    )(data);
}

/**
 * @param {string} group
 *
 * @returns {Promise<CustomFields>}
 */
function fetchCustomFields(group) {
    return db
        .query(
            'SELECT "fields" FROM "public"."customColumns" WHERE "resourceGroup" = $1',
            [group]
        )
        .then((res) =>
            _.getOr(
                {},
                0,
                res.rows.map((r) => r.fields)
            )
        );
}

/**
 * @param {any} val
 *
 * @returns {string|null}
 */
function inferType(val) {
    if (val == null) {
        return null;
    }

    switch (typeof val) {
        case 'string':
            return 'string';
        case 'number':
            return 'integer';
        case 'boolean':
            return 'boolean';
        case 'object':
            if (Array.isArray(val)) {
                return 'string_array';
            }

            return 'object';
    }

    throw new Error(`Cannot infer value: ${JSON.stringify(val)}.`);
}

/**
 * @param {object} column
 *
 * @returns {string}
 */
function columnDbType(column) {
    const Schema = _.getOr({}, 'schema', column);
    switch (Schema.type) {
        case 'string':
            if (_.some((rule) => rule.name === 'guid', Schema._rules)) {
                return 'uuid';
            }

            return 'text';
        case 'number':
            return 'int';
        case 'boolean':
            return 'bool';
        case 'array':
            return 'text[]';
        case 'object':
            return 'jsonb';
    }

    throw new Error(`Cannot convert schema type ${type} to db type.`);
}

/**
 * @param {string|null} type
 *
 * @returns {import('../../joi').Root}
 */
function typeToSchema(type) {
    if (type == null) {
        return Joi.any();
    }

    switch (type) {
        case 'string':
            return Joi.string();
        case 'integer':
            return Joi.number().integer();
        case 'boolean':
            return Joi.boolean();
        case 'string_array':
            return Joi.array().items(Joi.string());
        case 'object':
            return Joi.object();
    }

    throw new Error(`Cannot convert type ${type} into schema.`);
}

/**
 * @param {CustomField} field
 *
 * @return {{type: import('joi').Root}}
 */
function customFieldToColumn(field) {
    return {schema: typeToSchema(field.type)};
}

/**
 * @param {{client: import('../../db').Client, group: string}} context
 * @param {{new: CustomFields}} customFields
 *
 * @returns {Promise}
 */
async function storeNew({client, group}, customFields) {
    const newCustomFields = customFields.new;
    if (_.isEmpty(newCustomFields)) {
        return;
    }

    await client.query(
        `
INSERT INTO "public"."customColumns"
  ("resourceGroup", "fields")
VALUES
  ($1, $2)
ON CONFLICT ("resourceGroup")
DO UPDATE SET "fields" = EXCLUDED."fields" || "customColumns"."fields"
`,
        [group, JSON.stringify(newCustomFields)]
    );
}

/**
 * @param {CustomField} customFields
 *
 * @returns {object}
 */
function filterColumnsConfig(customFields) {
    const allCustomFields = _.getOr({}, 'all', customFields);

    return _.mapValues(_.always({}), allCustomFields);
}

/**
 * @param {{group: string}} context
 */
function selectCustomFieldMiddleware({group}) {
    return async function (request, response, next) {
        const definedCustomFields = await fetchCustomFields(group);
        request.customFields = {
            defined: definedCustomFields,
            all: definedCustomFields,
        };

        const columns = _.mapValues(customFieldToColumn, definedCustomFields);

        const BodySchema = Joi.object().keys({
            filter: schemaUtil.filter(columns),
            order: schemaUtil.order(columns),
        });

        request.match = _.update(
            ['data', 'parameters', 'body'],
            (Schema) => Schema.concat(BodySchema),
            request.match
        );

        next();
    };
}

/**
 * @param {{plan: import('./compiler').Plan, group: string}} context
 */
function modifyCustomFieldMiddleware({plan, group}) {
    return async function (request, response, next) {
        const definedCustomFields = await fetchCustomFields(group);
        const definedCustomFieldNames = set.from(
            Object.keys(definedCustomFields)
        );

        const validNames = validGroupDataNames({plan, group});

        const data = request.parameters.body.data;
        const customFields = set.difference(extractFields(data), validNames);

        const unknownCustomFields = set.difference(
            customFields,
            definedCustomFieldNames
        );

        const newCustomFields =
            unknownCustomFields.size === 0
                ? {}
                : inferFieldTypes(unknownCustomFields, data);

        const allCustomFields = _.mergeAll([
            definedCustomFields,
            newCustomFields,
        ]);

        request.customFields = {
            defined: definedCustomFields,
            new: newCustomFields,
            all: allCustomFields,
        };

        const columns = _.mapValues(customFieldToColumn, allCustomFields);

        const ColSchema = Joi.object().keys(
            _.mapValues((col) => col.schema, columns)
        );
        const TypeSchema = Joi.array().items(
            Joi.object().keys({data: ColSchema})
        );
        const BodySchema = Joi.object().keys({
            data: Joi.object().keys(_.mapValues(() => TypeSchema, plan[group])),
        });

        const validationResult = BodySchema.validate(request.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (validationResult.error) {
            if (validationResult.error) {
                return next(
                    new HttpError(
                        400,
                        apiUtil.createDataErrorObject(validationResult.error)
                    )
                );
            }
        }

        const resultData = validationResult.value.data;
        const dataWithCustomFields = mapValuesWithKey((records, type) => {
            return mapWithKey((record, index) => {
                return _.update(
                    'data',
                    (val) => {
                        return _.merge(
                            val,
                            _.getOr({}, [type, index, 'data'], resultData)
                        );
                    },
                    record
                );
            }, records);
        }, data);

        request.parameters.body.data = dataWithCustomFields;

        next();
    };
}

module.exports = {
    schema,
    listQuery,
    create,
    update,
    formatRow,
    validDataNames,
    validGroupDataNames,
    extractFields,
    inferFieldTypes,
    storeNew,
    selectCustomFieldMiddleware,
    modifyCustomFieldMiddleware,
    sortExpr,
    filterColumnsConfig,
    customFieldToColumn,
    columnDbType,
    fieldExpr,
};
