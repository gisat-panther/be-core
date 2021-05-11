const Joi = require('joi');
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
    (joi) => ({
        type: 'fieldName',
        base: Joi.string().meta({baseType: 'string'}),
        validate: (value, helpers) => {
            if (value != null && !/^[A-Za-z]*$/.test(value)) {
                return {value, errors: helpers.error('fieldName.base')};
            }
        },
    }),
];

/**
 * @typedef {import('joi').StringSchema} StringArraySchema
 *
 * @typedef {import('joi').StringSchema} IsoDurationSchema
 *
 * @typedef {import('joi').StringSchema} FieldNameSchema
 *
 * @typedef ExtensionRoot
 * @property {() => StringArraySchema} stringArray
 * @property {() => IsoDurationSchema} isoDuration
 * @property {() => FieldNameSchema} fieldName
 *
 * @typedef {import('joi').Root & ExtensionRoot} Root
 *
 * @type {Root}
 */
const CustomJoi = extensions.reduce((joi, ext) => joi.extend(ext), Joi);

module.exports = CustomJoi;
