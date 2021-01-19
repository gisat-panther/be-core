const {assert} = require('chai');
const set = require('../src/set');

describe('set', function () {
    describe('from', function () {
        const tests = [
            {
                name: 'null',
                value: null,
                expectedValue: new Set(),
            },
            {
                name: 'undefined',
                value: undefined,
                expectedValue: new Set(),
            },
            {
                name: 'array',
                value: [1, 2, 3],
                expectedValue: new Set([1, 2, 3]),
            },
            {
                name: 'set',
                value: new Set([1, 2, 3]),
                expectedValue: new Set([1, 2, 3]),
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    set.from(test.value),
                    test.expectedValue
                );
            });
        });
    });

    it('union', function () {
        assert.deepStrictEqual(
            set.union(set.from([1, 2]), set.from([2, 3])),
            new Set([1, 2, 3])
        );
    });

    it('difference', function () {
        assert.deepStrictEqual(
            set.difference(set.from([1, 2]), set.from([2, 3])),
            new Set([1])
        );
    });
});
