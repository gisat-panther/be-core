const {assert} = require('chai');
const Joi = require('../src/joi');
const moment = require('moment');

describe('joi', function () {
    describe('stringArray', function () {
        const tests = [
            {
                name: 'single item',
                value: 'one',
                schema: Joi.stringArray().items(Joi.string()),
                expectedValue: ['one'],
            },
            {
                name: 'two items',
                value: 'one,two',
                schema: Joi.stringArray().items(Joi.string()),
                expectedValue: ['one', 'two'],
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(test.schema.validate(test.value), {
                    value: test.expectedValue,
                });
            });
        });
    });

    describe('isoDuration', function () {
        describe('valid', function () {
            const tests = [
                {
                    name: 'using dates in both ends',
                    value: '2013-03-01/2013-04-01',
                    schema: Joi.isoDuration(),
                },
                {
                    name: 'using a start date and a period',
                    value: '2012-03-01/P1Y',
                    schema: Joi.isoDuration(),
                },
                {
                    name: 'using a period and an end date',
                    value: '/P28D',
                    schema: Joi.isoDuration(),
                },
                {
                    name: 'using a period and the current date',
                    value: 'P28D/',
                    schema: Joi.isoDuration(),
                },
            ];

            tests.forEach((test) => {
                it(test.name, function () {
                    assert.deepStrictEqual(test.schema.validate(test.value), {
                        value: test.value,
                    });
                });
            });
        });

        describe('invalid', function () {
            this.beforeAll(function() {
                // As we test with invalid values that show warnings due to parsing fallback
                // using `Date`, let's suppress the warnings to not confuse people reading test output.
                // Warning is expected behaviour until moment removes the Date parsing fallback.
                moment.suppressDeprecationWarnings = true;
            });

            this.afterAll(function() {
                moment.suppressDeprecationWarnings = false;
            });

            const tests = [
                {
                    name: 'using dates in both ends',
                    value: 'nonsense',
                    schema: Joi.isoDuration(),
                },
            ];

            tests.forEach((test) => {
                it(test.name, function () {
                    const result = test.schema.validate(test.value);

                    assert.deepStrictEqual(
                        result.error.details.map((detail) => detail.type),
                        ['isoDuration.interval']
                    );
                });
            });
        });
    });

    describe('fieldName', function () {
        describe('valid', function () {
            const tests = [
                {
                    name: 'valid',
                    value: 'camelCase',
                    schema: Joi.fieldName(),
                },
            ];

            tests.forEach((test) => {
                it(test.name, function () {
                    assert.deepStrictEqual(test.schema.validate(test.value), {
                        value: test.value,
                    });
                });
            });
        });

        describe('invalid', function () {
            const tests = [
                {
                    name: 'invalid underscore',
                    value: 'snake_case',
                    schema: Joi.fieldName(),
                },
                {
                    name: 'invalid dash',
                    value: 'kebab-case',
                    schema: Joi.fieldName(),
                },
            ];

            tests.forEach((test) => {
                it(test.name, function () {
                    const result = test.schema.validate(test.value);

                    assert.deepStrictEqual(
                        result.error.details.map((detail) => detail.type),
                        ['fieldName.base']
                    );
                });
            });
        });
    });
});
