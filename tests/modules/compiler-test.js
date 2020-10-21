const {assert} = require('chai');
const compiler = require('../../src/modules/rest/compiler');
const _ = require('lodash/fp');

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
                t3: {
                    context: {
                        create: {
                            columns: ['ca', 'cb'],
                        },
                        update: {
                            columns: ['ua', 'ub'],
                        },
                    },
                    columns: {
                        ca: {},
                        cb: {},
                        cbi: {
                            inputs: ['ca'],
                        },
                        ua: {},
                        ub: {},
                        uai: {
                            inputs: ['ua'],
                        },
                    },
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
                t3: {
                    table: 't3',
                    context: {
                        create: {
                            columns: ['ca', 'cb'],
                            queryColumns: ['cbi'],
                        },
                        update: {
                            columns: ['ua', 'ub'],
                            queryColumns: ['uai'],
                        },
                    },
                    columns: {
                        ca: {},
                        cb: {},
                        cbi: {
                            inputs: ['ca'],
                        },
                        ua: {},
                        ub: {},
                        uai: {
                            inputs: ['ua'],
                        },
                    },
                },
            },
        };

        const compiledPlan = compiler.compile(plan);
        const compiledPlanWithoutFns = _.mapValues(
            (group) =>
                _.mapValues(
                    (type) =>
                        _.update(
                            'columns',
                            (columns) =>
                                _.mapValues(
                                    (column) =>
                                        _.omit(
                                            ['selectExpr', 'modifyExpr'],
                                            column
                                        ),
                                    columns
                                ),
                            type
                        ),
                    group
                ),
            compiledPlan
        );
        assert.deepStrictEqual(compiledPlanWithoutFns, expectedPlan);
    });
});
