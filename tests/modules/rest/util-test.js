const {assert} = require('chai');
const util = require('../../../src/modules/rest/util');

describe('modules/rest/util', function () {
    describe('restrictedColumns', function () {
        const tests = [
            {
                name: 'none',
                plan: {g: {t: {columns: {c1: {}, c2: {}}}}},
                group: 'g',
                type: 't',
                expectedResult: {},
            },
            {
                name: 'some',
                plan: {
                    g: {
                        t: {
                            columns: {
                                c1: {},
                                c2: {
                                    relation: {
                                        resourceGroup: 'g2',
                                        resourceType: 't2',
                                    },
                                },
                            },
                        },
                    },
                },
                group: 'g',
                type: 't',
                expectedResult: {
                    c2: {
                        relation: {
                            resourceGroup: 'g2',
                            resourceType: 't2',
                        },
                    },
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    util.restrictedColumns(test.plan, test.group, test.type),
                    test.expectedResult
                );
            });
        });
    });

    describe('requiredColumnPermissions', function () {
        const tests = [
            {
                name: 'some',
                data: {
                    t1: [
                        {
                            data: {
                                c1: 'val',
                                c2: 'val2',
                            },
                        },
                        {
                            data: {
                                c3: 'val3',
                                c1: 'val1',
                            },
                        },
                    ],
                    t2: [
                        {
                            data: {
                                ct1: 'vt1',
                                ct2: 'vt2',
                            },
                        },
                    ],
                },
                plan: {
                    g: {
                        t1: {
                            columns: {
                                c1: {
                                    relation: {
                                        resourceGroup: 'g2',
                                        resourceType: 't2',
                                    },
                                },
                                c2: {
                                    relation: {
                                        resourceGroup: 'g3',
                                        resourceType: 't3',
                                    },
                                },
                                c3: {},
                            },
                        },
                        t2: {
                            columns: {
                                ct1: {},
                                ct2: {},
                            },
                        },
                    },
                },
                group: 'g',
                expectedResult: [
                    {
                        permission: 'create',
                        resourceGroup: 'g2',
                        resourceKey: ['val', 'val1'],
                        resourceType: 't2',
                    },
                    {
                        permission: 'create',
                        resourceGroup: 'g3',
                        resourceKey: ['val2'],
                        resourceType: 't3',
                    },
                ],
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    util.requiredColumnPermissions(
                        test.plan,
                        test.group,
                        test.data,
                        'create'
                    ),
                    test.expectedResult
                );
            });
        });
    });
});
