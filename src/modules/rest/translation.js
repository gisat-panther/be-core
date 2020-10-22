const Joi = require('../../joi');
const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');

function translationData(type, records) {
    const translations = [];
    records.forEach(function (record) {
        const recordTranslations = _.getOr({}, 'translations', record);
        Object.entries(recordTranslations).forEach(([locale, translation]) => {
            Object.entries(translation).forEach(([field, value]) => {
                translations.push([
                    qb.val.inlineParam(record.key),
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
        columns: ['resourceKey', 'resourceType', 'locale', 'field', 'value'],
        values: translations,
    };
}

async function updateTranslations({client, type}, records) {
    const translations = translationData(type, records);
    if (translations == null) {
        return null;
    }

    const sqlMap = qb.merge(
        qb.insertInto('public.translations'),
        qb.columns(translations.columns),
        qb.values(translations.values),
        qb.onConflict(['resourceKey', 'resourceType', 'locale', 'field']),
        qb.doUpdate([qb.expr.eq('value', qb.val.raw('EXCLUDED."value"'))])
    );

    await client.query(qb.toSql(sqlMap));
}

function schema() {
    return {
        translations: Joi.object().pattern(
            Joi.string().min(1),
            Joi.object().pattern(Joi.string().min(1), Joi.any())
        ),
    };
}

module.exports = {
    schema,
    updateTranslations,
};
