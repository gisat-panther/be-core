const Joi = require('../../joi');
const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');
const SQL = require('sql-template-strings');
const cf = require('./custom-fields');
const schemaUtil = require('./schema-util');
const apiUtil = require('../../util/api');
const commandResult = require('./result');

const mapWithKey = _.map.convert({cap: false});
const mapValuesWithKey = _.mapValues.convert({cap: false});

/**
 * @param {{group: string, type: string}} context
 * @param {object[]} records
 *
 * @returns {{columns: string[], values: any[]} | null}
 */
function translationData({group, type}, records) {
    const translations = [];
    records.forEach(function (record) {
        const recordTranslations = _.getOr({}, 'translations', record);
        Object.entries(recordTranslations).forEach(([locale, translation]) => {
            Object.entries(translation).forEach(([field, value]) => {
                translations.push([
                    qb.val.inlineParam(record.key),
                    qb.val.inlineParam(group),
                    qb.val.inlineParam(type),
                    qb.val.inlineParam(locale),
                    qb.val.inlineParam(field),
                    qb.val.inlineParam(JSON.stringify(value)),
                ]);
            });
        });
    });

    if (translations.length === 0) {
        return null;
    }

    return {
        columns: [
            'resourceKey',
            'resourceGroup',
            'resourceType',
            'locale',
            'field',
            'value',
        ],
        values: translations,
    };
}

/**
 * @param {{client: import('../../db').Client, group: string, type: string}} context
 * @param {object[]} records
 *
 * @returns {Promise<undefined>}
 */
async function updateTranslations({client, group, type}, records) {
    const translations = translationData({group, type}, records);
    if (translations == null) {
        return null;
    }

    const sqlMap = qb.merge(
        qb.insertInto('public.translations'),
        qb.columns(translations.columns),
        qb.values(translations.values),
        qb.onConflict([
            'resourceKey',
            'resourceGroup',
            'resourceType',
            'locale',
            'field',
        ]),
        qb.doUpdate([qb.expr.eq('value', qb.val.raw('EXCLUDED."value"'))])
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {{group: string, type: string, translations: string[]}} context
 * @param {string} alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listTranslationsQuery({group, type, translations}, alias) {
    if (_.size(translations) === 0) {
        return {};
    }

    const orderBys = _.map(
        (trans) =>
            qb.orderBy(
                qb.val.raw(SQL`("_ptrans"."locale" = ${trans})::int`),
                'DESC'
            ),
        translations
    );

    const translationsMap = qb.merge(
        qb.selectDistinct(
            ['"_ptrans"."field"'],
            ['"_ptrans"."locale"', '"_ptrans"."field"', '"_ptrans"."value"']
        ),
        qb.from('"public"."translations"', '"_ptrans"'),
        qb.where(
            qb.expr.and(
                qb.val.raw(
                    SQL`("t"."key"::text = "_ptrans"."resourceKey" AND "_ptrans"."resourceGroup" = ${group} AND "_ptrans"."resourceType" = ${type})`
                ),
                qb.expr.in(
                    '"_ptrans"."locale"',
                    translations.map(qb.val.inlineParam)
                )
            )
        ),
        qb.append(qb.orderBy('"_ptrans"."field"'), ...orderBys)
    );

    return qb.select([
        qb.expr.as(
            qb.merge(
                qb.select([
                    qb.val.raw(
                        'JSON_OBJECT_AGG("_trans"."locale", "_trans"."t") _translation'
                    ),
                ]),
                qb.from(
                    qb.merge(
                        qb.select([
                            '"_ptrans"."locale"',
                            qb.val.raw(
                                'JSON_OBJECT_AGG("_ptrans"."field", "_ptrans"."value") "t"'
                            ),
                        ]),
                        qb.from(translationsMap, '"_ptrans"'),
                        qb.groupBy(['"_ptrans"."locale"'])
                    ),
                    '"_trans"'
                )
            ),
            '"__translations"'
        ),
    ]);
}

/**
 * @param {{group: string, type: string, translations: string[]}} context
 * @param {{alias: string, field: string}} field
 */
function sortExpr(
    {plan, group, type, translations, customFields},
    {alias, field, order}
) {
    if (_.size(translations) === 0) {
        return null;
    }

    const columns = groupColumns({plan, group, customFields});

    const orderBys = _.map(
        (trans) =>
            qb.orderBy(
                qb.val.raw(SQL`("_ptrans"."locale" = ${trans})::int`),
                'DESC'
            ),
        translations
    );
    const dbType = cf.columnDbType(_.get(field, columns));

    const translationSqlMap = qb.merge(
        qb.select([
            qb.val.raw(SQL``.append(`("_ptrans"."value" #>> '{}')::${dbType}`)),
        ]),
        qb.from('public.translations', '_ptrans'),
        qb.where(
            qb.expr.and(
                qb.expr.eq(
                    qb.val.raw('"t"."key"::text'),
                    '_ptrans.resourceKey'
                ),
                qb.expr.eq('_ptrans.resourceGroup', qb.val.inlineParam(group)),
                qb.expr.eq('_ptrans.resourceType', qb.val.inlineParam(type)),
                qb.expr.eq('_ptrans.field', qb.val.inlineParam(field)),
                qb.expr.in(
                    '_ptrans.locale',
                    translations.map(qb.val.inlineParam)
                )
            )
        ),
        qb.append(...orderBys),
        qb.limit(1)
    );

    const fieldExpr =
        cf.fieldExpr({customFields}, {alias, field}) || `${alias}.${field}`;

    const sqlMap = qb.merge(
        qb.select([qb.expr.fn('COALESCE', translationSqlMap, fieldExpr)])
    );

    return qb.orderBy(sqlMap, order === 'ascending' ? 'ASC' : 'DESC');
}

function filterFieldExpr(
    {plan, group, type, translations, customFields},
    {alias, field}
) {
    if (_.size(translations) === 0) {
        return null;
    }

    const columns = groupColumns({plan, group, customFields});

    const orderBys = _.map(
        (trans) =>
            qb.orderBy(
                qb.val.raw(SQL`("_ptrans"."locale" = ${trans})::int`),
                'DESC'
            ),
        translations
    );

    const dbType = cf.columnDbType(_.get(field, columns));

    const translationSqlMap = qb.merge(
        qb.select([
            qb.val.raw(SQL``.append(`("_ptrans"."value" #>> '{}')::${dbType}`)),
        ]),
        qb.from('public.translations', '_ptrans'),
        qb.where(
            qb.expr.and(
                qb.expr.eq(
                    qb.val.raw('"t"."key"::text'),
                    '_ptrans.resourceKey'
                ),
                qb.expr.eq('_ptrans.resourceGroup', qb.val.inlineParam(group)),
                qb.expr.eq('_ptrans.resourceType', qb.val.inlineParam(type)),
                qb.expr.eq('_ptrans.field', qb.val.inlineParam(field)),
                qb.expr.in(
                    '_ptrans.locale',
                    translations.map(qb.val.inlineParam)
                )
            )
        ),
        qb.append(...orderBys),
        qb.limit(1)
    );

    const fieldExpr =
        cf.fieldExpr({customFields}, {alias, field}) || `${alias}.${field}`;

    const sqlMap = qb.merge(
        qb.select([qb.expr.fn('COALESCE', translationSqlMap, fieldExpr)])
    );

    return sqlMap;
}

const LocaleSchema = Joi.string().min(1);

/**
 * @returns {object}
 */
function schema() {
    return {
        translations: Joi.object().pattern(
            LocaleSchema,
            Joi.object().pattern(Joi.fieldName(), Joi.any())
        ),
    };
}

/**
 * @returns {object}
 */
function listSchema() {
    return {
        translations: Joi.array().items(LocaleSchema).min(1),
    };
}

/**
 * @param {object} row
 *
 * @returns {object}
 */
function formatRow(row) {
    const translations = _.get(['data', '__translations'], row);
    if (translations === undefined) {
        return row;
    }

    return _.flow(
        _.update('data', _.omit('__translations')),
        _.set('translations', translations)
    )(row);
}

/**
 * @param {{group: string, type: string}} context
 * @param {any[]} ids
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function lastChangeExprs({group, type}, ids) {
    if (ids == null && ids.length === 0) {
        return [];
    }

    return [
        qb.expr.and(
            qb.expr.eq('a.schema_name', qb.val.inlineParam('public')),
            qb.expr.eq('a.table_name', qb.val.inlineParam('translations')),
            qb.expr.eq(
                qb.val.raw(
                    `"a"."row_data" OPERATOR("public".->) 'resourceGroup'`
                ),
                qb.val.inlineParam(group)
            ),
            qb.expr.eq(
                qb.val.raw(
                    `"a"."row_data" OPERATOR("public".->) 'resourceType'`
                ),
                qb.val.inlineParam(type)
            ),
            qb.expr.in(
                qb.val.raw(
                    `"a"."row_data" OPERATOR("public".->) 'resourceKey'`
                ),
                ids.map(qb.val.inlineParam)
            )
        ),
    ];
}

/**
 * @param {{plan: import('./compiler').Plan, group: string, customFields: {all: import('./custom-fields').CustomFields}}} param0
 *
 * @returns {Object<string, import('./compiler').Column>}
 */
function groupColumns({plan, group, customFields}) {
    return schemaUtil.mergeColumns([
        ..._.flatMap((s) => {
            const types = _.getOr({}, ['type', 'types'], 3);

            return schemaUtil.mergeColumns(
                _.concat(
                    [s.columns],
                    _.map((t) => t.columns, types)
                )
            );
        }, plan[group]),
        _.mapValues(cf.customFieldToColumn, _.getOr({}, 'all', customFields)),
    ]);
}

/**
 * @param {{plan: import('./compiler').Plan, group: string}} context
 * @param {object} request
 */
async function modifyTranslationRequest({plan, group}, request) {
    const columns = groupColumns({
        plan,
        group,
        customFields: request.customFields,
    });

    const TranslationSchema = Joi.object().keys(
        _.omitBy(
            _.isNil,
            _.mapValues((col) => col.schema, columns)
        )
    );

    const RecordSchema = Joi.object().keys({
        translations: Joi.object().pattern(LocaleSchema, TranslationSchema),
    });
    const TypeSchema = Joi.array().items(RecordSchema);
    const BodySchema = Joi.object().keys({
        data: Joi.object().keys(_.mapValues(() => TypeSchema, plan[group])),
    });

    const validationResult = BodySchema.validate(request.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (validationResult.error) {
        if (validationResult.error) {
            return {
                type: commandResult.BAD_REQUEST,
                data: apiUtil.createDataErrorObject(validationResult.error),
            };
        }
    }

    const data = request.parameters.body.data;
    const resultData = validationResult.value.data;

    const dataWithTranslations = mapValuesWithKey((records, type) => {
        return mapWithKey((record, index) => {
            const translations = _.getOr(
                {},
                [type, index, 'translations'],
                resultData
            );

            return _.set('translations', translations, record);
        }, records);
    }, data);

    request.parameters.body.data = dataWithTranslations;
}

module.exports = {
    schema,
    listSchema,
    updateTranslations,
    listTranslationsQuery,
    formatRow,
    lastChangeExprs,
    sortExpr,
    modifyTranslationRequest,
    filterFieldExpr,
};
