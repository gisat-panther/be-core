const {assert} = require('chai');
const p = require('../src/postgres');

describe('postgres', function () {
    describe('intervalToRange', function () {
        const tests = [
            {
                name: 'using dates in both ends',
                value: '2013-03-01/2013-04-01',
                expectedValue:
                    '["2013-03-01T00:00:00.000Z","2013-04-01T00:00:00.000Z"]',
            },
            {
                name: 'using a start date and a period',
                value: '2012-03-01/P1Y',
                expectedValue:
                    '["2012-03-01T00:00:00.000Z","2013-03-01T00:00:00.000Z"]',
            },
            {
                name: 'using a year',
                value: '2012',
                expectedValue:
                    '["2012-01-01T00:00:00.000Z","2012-12-31T23:59:59.999Z"]',
            },
            {
                name: 'using a year-month',
                value: '2012-03',
                expectedValue:
                    '["2012-03-01T00:00:00.000Z","2012-03-31T23:59:59.999Z"]',
            },
            {
                name: 'using a year-month-day',
                value: '2012-03-03',
                expectedValue:
                    '["2012-03-03T00:00:00.000Z","2012-03-03T23:59:59.999Z"]',
            },
            {
                name: 'using a year-month-dayThour',
                value: '2012-03-03T01',
                expectedValue:
                    '["2012-03-03T01:00:00.000Z","2012-03-03T01:59:59.999Z"]',
            },
            {
                name: 'using a year-month-dayThour:minute',
                value: '2012-03-03T01:04',
                expectedValue:
                    '["2012-03-03T01:04:00.000Z","2012-03-03T01:04:59.999Z"]',
            },
            {
                name: 'using a year-month-dayThour:minute:second',
                value: '2012-03-03T01:04:02',
                expectedValue:
                    '["2012-03-03T01:04:02.000Z","2012-03-03T01:04:02.999Z"]',
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.strictEqual(
                    p.intervalToRange(test.value),
                    test.expectedValue
                );
            });
        });
    });
});
