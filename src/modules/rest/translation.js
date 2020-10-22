const Joi = require('../../joi');
const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');

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

function listTranslationsQuery({group, type, translations}, alias) {
    if (_.size(translations) === 0) {
        return {};
    }

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
                        qb.from('public.translations', '_ptrans'),
                        qb.where(
                            qb.expr.and(
                                qb.expr.eq(
                                    qb.val.raw('"t"."key"::text'),
                                    '_ptrans.resourceKey'
                                ),
                                qb.expr.eq(
                                    '_ptrans.resourceGroup',
                                    qb.val.inlineParam(group)
                                ),
                                qb.expr.eq(
                                    '_ptrans.resourceType',
                                    qb.val.inlineParam(type)
                                ),
                                qb.expr.in(
                                    '_ptrans.locale',
                                    translations.map(qb.val.inlineParam)
                                )
                            )
                        ),
                        qb.groupBy(['_ptrans.locale'])
                    ),
                    '_trans'
                )
            ),
            '__translations'
        ),
    ]);
}

const LocaleSchema = Joi.string().min(1);

function schema() {
    return {
        translations: Joi.object().pattern(
            Joi.string().min(1),
            Joi.object().pattern(LocaleSchema, Joi.any())
        ),
    };
}

function listSchema() {
    return {
        translations: Joi.array().items(LocaleSchema).min(1),
    };
}

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

module.exports = {
    schema,
    listSchema,
    updateTranslations,
    listTranslationsQuery,
    formatRow,
};
