const {assert} = require('chai');
const compiler = require('../../src/modules/rest/compiler');

describe('modules/rest/compiler', function () {
    it('compile', function () {
        const plan = {
            g1: {
                t1: {
                    // default table
                    columns: {},
                },
                t2: {
                    table: 't3',
                    columns: {},
                },
            },
        };

        const expectedPlan = {
            g1: {
                t1: {
                    table: 't1',
                    columns: {},
                },
                t2: {
                    table: 't3',
                    columns: {},
                },
            },
        };

        assert.deepStrictEqual(compiler.compile(plan), expectedPlan);
    });
});
