const Joi = require('../../joi');
const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');
const SQL = require('sql-template-strings');

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
            ['_ptrans.field'],
            ['_ptrans.locale', '_ptrans.field', '_ptrans.value']
        ),
        qb.from('public.translations', '_ptrans'),
        qb.where(
            qb.expr.and(
                qb.expr.eq(
                    qb.val.raw('"t"."key"::text'),
                    '_ptrans.resourceKey'
                ),
                qb.expr.eq('_ptrans.resourceGroup', qb.val.inlineParam(group)),
                qb.expr.eq('_ptrans.resourceType', qb.val.inlineParam(type)),
                qb.expr.in(
                    '_ptrans.locale',
                    translations.map(qb.val.inlineParam)
                )
            )
        ),
        qb.append(qb.orderBy('_ptrans.field'), ...orderBys)
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
                            '_ptrans.locale',
                            qb.val.raw(
                                'JSON_OBJECT_AGG("_ptrans"."field", "_ptrans"."value") "t"'
                            ),
                        ]),
                        qb.from(translationsMap, '_ptrans'),
                        qb.groupBy(['_ptrans.locale'])
                    ),
                    '_trans'
                )
            ),
            '__translations'
        ),
    ]);
}

/**
 * @param {{group: string, type: string, translations: string[]}} context
 * @param {{alias: string, field: string}} field
 */
function sortExpr({group, type, translations}, {alias, field}) {
    if (_.size(translations) === 0) {
        return `${alias}.${field}`;
    }

    const orderBys = _.map(
        (trans) =>
            qb.orderBy(
                qb.val.raw(SQL`("_ptrans"."locale" = ${trans})::int`),
                'DESC'
            ),
        translations
    );

    const translationSqlMap = qb.merge(
        qb.select([qb.val.raw(SQL`"_ptrans"."value" #>> '{}'`)]),
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

    const sqlMap = qb.merge(
        qb.select([
            qb.expr.fn('COALESCE', translationSqlMap, `${alias}.${field}`),
        ])
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
            Joi.string().min(1),
            Joi.object().pattern(LocaleSchema, Joi.any())
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

module.exports = {
    schema,
    listSchema,
    updateTranslations,
    listTranslationsQuery,
    formatRow,
    lastChangeExprs,
    sortExpr,
};
