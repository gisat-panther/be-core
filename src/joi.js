const Joi = require('@hapi/joi');
const momentInterval = require('moment-interval');

const extensions = [
    (joi) => ({
        type: 'stringArray', // array items are encoded in string, separated by comma
        base: Joi.array().meta({baseType: 'array'}),
        coerce: (value) => {
            if (value != null && value.split) {
                return {value: value.split(',')};
            }
        },
    }),
    (joi) => ({
        type: 'isoDuration',
        base: Joi.string().meta({baseType: 'string'}),
        validate: (value, helpers) => {
            const {start, end} = momentInterval.interval(value);

            if (!start().isValid() || !end().isValid()) {
                return {value, errors: helpers.error('isoDuration.interval')};
            }
        },
    }),
];

module.exports = extensions.reduce((joi, ext) => joi.extend(ext), Joi);
