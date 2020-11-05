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
            {
                name: 'using a year-month-dayThour:minute:second:millisecond',
                value: '2012-03-03T01:04:02.111Z',
                expectedValue:
                    '["2012-03-03T01:04:02.111Z","2012-03-03T01:04:02.111Z"]',
            },
            {
                name: 'using a year-week',
                value: '2012-W11',
                expectedValue:
                    '["2012-03-12T00:00:00.000Z","2012-03-17T23:59:59.999Z"]',
            },
            {
                name: 'using a year-week-day',
                value: '2012-W11-3',
                expectedValue:
                    '["2012-03-14T00:00:00.000Z","2012-03-14T23:59:59.999Z"]',
            },
            {
                name: 'using a year-week-dayThour',
                value: '2012-W11-3T01',
                expectedValue:
                    '["2012-03-14T01:00:00.000Z","2012-03-14T01:59:59.999Z"]',
            },
            {
                name: 'using a year-week-dayTminute',
                value: '2012-W11-3T01:13',
                expectedValue:
                    '["2012-03-14T01:13:00.000Z","2012-03-14T01:13:59.999Z"]',
            },
            {
                name: 'using a year-week-dayTminute:second',
                value: '2012-W11-3T01:13:33',
                expectedValue:
                    '["2012-03-14T01:13:33.000Z","2012-03-14T01:13:33.999Z"]',
            },
            {
                name: 'using a year-week-dayTminute:second:millisecond',
                value: '2012-W11-3T01:13:33.222Z',
                expectedValue:
                    '["2012-03-14T01:13:33.222Z","2012-03-14T01:13:33.222Z"]',
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
