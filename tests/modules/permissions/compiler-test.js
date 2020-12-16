const {assert} = require('chai');
const compiler = require('../../../src/modules/permissions/compiler');

describe('modules/permissions/compiler', function () {
    it('compile', function () {
        assert.deepStrictEqual(
            compiler.compile(
                {
                    plan: {
                        user: {
                            user: {
                                table: 'users',
                            },
                        },
                    },
                },
                {
                    demo__target_group: {
                        sourceGroups: ['demo_sourceGroup'],
                        targetGroups: ['demo_targetGroup'],
                        targetPermissions: ['view'],
                    },
                    demo__email_domain: {
                        targets: {
                            user: {
                                user: {},
                                missingType: {},
                            },
                        },
                        targetPermissions: ['view'],
                    },
                }
            ),
            {
                demo__email_domain: {
                    hash: '15d4681df95e72c3b97508d2d88de11762f86527',
                    targetPermissions: ['view'],
                    targets: {
                        user: {
                            missingType: {
                                table: 'missingType',
                            },
                            user: {
                                table: 'users',
                            },
                        },
                    },
                },
                demo__target_group: {
                    hash: 'e083191962e9f77139a969158f2f05492d54a1ba',
                    sourceGroups: ['demo_sourceGroup'],
                    targetGroups: ['demo_targetGroup'],
                    targetPermissions: ['view'],
                },
            }
        );
    });
});
