const {assert} = require('chai');
const customFields = require('../../../src/modules/rest/custom-fields');

describe('modules/rest/custom-fields', function () {
    describe('validDataNames', function () {
        const tests = [
            {
                name: 'columns',
                context: {
                    plan: {
                        group: {
                            type: {
                                columns: {
                                    c1: {},
                                    c2: {},
                                },
                            },
                        },
                    },
                    group: 'group',
                    type: 'type',
                },
                expectedResult: ['c1', 'c2'],
            },
            {
                name: 'relations',
                context: {
                    plan: {
                        group: {
                            type: {
                                relations: {
                                    rel1: {
                                        type: 'manyToOne',
                                    },
                                    rel2: {
                                        type: 'manyToMany',
                                    },
                                },
                            },
                        },
                    },
                    group: 'group',
                    type: 'type',
                },
                expectedResult: ['rel1Key', 'rel2Keys'],
            },
            {
                name: 'types columns',
                context: {
                    plan: {
                        group: {
                            type: {
                                type: {
                                    types: {
                                        t1: {
                                            columns: {
                                                c1: {},
                                            },
                                        },
                                        t2: {
                                            columns: {
                                                c2: {},
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    group: 'group',
                    type: 'type',
                },
                expectedResult: ['c1', 'c2'],
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    customFields.validDataNames(test.context),
                    test.expectedResult
                );
            });
        });
    });
});
