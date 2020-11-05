const chai = require('chai');
const {assert} = chai;
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

    describe('validGroupDataNames', function () {
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
                            type2: {
                                columns: {
                                    c3: {},
                                },
                            },
                        },
                    },
                    group: 'group',
                },
                expectedResult: new Set(['c1', 'c2', 'c3']),
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
                            type2: {
                                relations: {
                                    rel1: {
                                        type: 'manyToOne',
                                    },
                                },
                            },
                        },
                    },
                    group: 'group',
                },
                expectedResult: new Set(['rel1Key', 'rel2Keys']),
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
                },
                expectedResult: new Set(['c1', 'c2']),
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    customFields.validGroupDataNames(test.context),
                    test.expectedResult
                );
            });
        });
    });

    describe('extractFields', function () {
        const tests = [
            {
                name: 'empty',
                data: {},
                expectedResult: new Set([]),
            },
            {
                name: 'mix',
                data: {
                    type1: [
                        {
                            data: {
                                f1: 'type1.f1.val',
                                f2: 'type1.f2.val',
                            },
                            translations: {
                                loc1: {
                                    t1: 'type1.t1.val',
                                },
                                loc2: {
                                    t2: 'type1.t2.val',
                                },
                            },
                        },
                    ],
                    type2: [
                        {
                            data: {
                                f2: 'type2.f2.val',
                                f3: 'type2.f3.val',
                            },
                            translations: {
                                loc3: {
                                    t2: 'type2.t2.val',
                                },
                                loc4: {
                                    t3: 'type2.t3.val',
                                },
                            },
                        },
                    ],
                    type3: [],
                },
                expectedResult: new Set(['f1', 'f2', 'f3', 't1', 't2', 't3']),
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    customFields.extractFields(test.data),
                    test.expectedResult
                );
            });
        });
    });

    describe('inferFieldTypes', function () {
        const tests = [
            {
                name: 'empty',
                data: {},
                unknownCustomFields: new Set(),
                expectedResult: {},
            },
            {
                name: 'mix',
                data: {
                    type1: [
                        {
                            data: {
                                f1: 'type1.f1.val',
                                f2: 2,
                                f3: true,
                                f4: 'f4.not_included',
                            },
                            translations: {
                                loc1: {
                                    t1: ['first', 'second'],
                                },
                                loc2: {
                                    t2: 'type1.t2.val',
                                    t3: {prop: 'val'},
                                },
                            },
                        },
                    ],
                },
                unknownCustomFields: new Set(['f1', 'f2', 'f3', 't1', 't3']),
                expectedResult: {
                    f1: {type: 'string'},
                    f2: {type: 'integer'},
                    f3: {type: 'boolean'},
                    t1: {type: 'string_array'},
                    t3: {type: 'object'},
                },
            },
        ];

        tests.forEach((test) => {
            it(test.name, function () {
                assert.deepStrictEqual(
                    customFields.inferFieldTypes(
                        test.unknownCustomFields,
                        test.data
                    ),
                    test.expectedResult
                );
            });
        });
    });
});
