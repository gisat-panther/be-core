const {assert} = require('chai');
const h = require('../helper');
const db = require('../../src/db');
const permission = require('../../src/permission');
const permissions = require('../../src/modules/permissions/index');
const getAppConfig = require('../../src/applications/config').get;

db.init();

async function loadFixtures(fixtures) {
    await Promise.all(
        Object.entries(fixtures).map(([table, records]) =>
            Promise.all(
                records.map((columns) => h.createRecord(table, columns))
            )
        )
    );
}

describe('modules/permissions', function () {
    const appConfig = getAppConfig();
    const ensurePermissionsAreGenerated = () =>
        permissions.runOnce({
            plan: appConfig.plan,
            generatedPermissions: appConfig.generatedPermissions,
        });

    const assingGroup = (user, group) =>
        db.query(
            'INSERT INTO "user"."userGroups"("userKey", "groupKey") VALUES($1, $2)',
            [user, group]
        );

    describe('demo__target_group', function () {
        const SOURCE_GROUP_KEY = '3c0cb4ed-2a9c-4f7c-b220-6603815f0800';
        const TARGET_GROUP_KEY = '3c0cb4ed-2a9c-4f7c-b220-6603815f0801';

        const USER1_KEY = '7eb18c2b-c353-4cac-99e6-814b52e12da1';
        const USER2_KEY = '866d471f-7317-459d-8ad6-811df4091e92';

        const fixtures = {
            '"user"."groups"': [
                {
                    key: SOURCE_GROUP_KEY,
                    name: 'demo_sourceGroup',
                },
                {
                    key: TARGET_GROUP_KEY,
                    name: 'demo_targetGroup',
                },
            ],
            '"user"."users"': [
                {
                    key: USER1_KEY,
                    email: 'demo1@example.com',
                },
                {
                    key: USER2_KEY,
                    email: 'demo2@example2.com',
                },
            ],
        };

        before(async function () {
            await loadFixtures(fixtures);
            h.newScope();
        });

        after(async function () {
            h.prevScope();
            await h.revertChanges();
        });

        it('works', async function () {
            const hasPermission = () =>
                permission.userHasAllPermissions({realKey: USER1_KEY}, [
                    {
                        resourceGroup: 'user',
                        resourceType: 'user',
                        resourceKey: [USER2_KEY],
                        permission: 'view',
                    },
                ]);

            const unassignGroup = (user, group) =>
                db.query(
                    'DELETE FROM "user"."userGroups" WHERE "userKey" = $1 AND "groupKey" = $2',
                    [user, group]
                );

            // guard
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // assign source group
            await assingGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // assign target group
            await assingGroup(USER2_KEY, TARGET_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // unassign source group
            await unassignGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // assign source group
            await assingGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // unassign target group
            await unassignGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());
        });
    });

    describe('demo__email_domain', function () {
        const USER1_KEY = 'f0c16b4c-0a0f-4b5f-8e66-33b1c1fce0b1';
        const USER2_KEY = 'f0c16b4c-0a0f-4b5f-8e66-33b1c1fce0b2';
        const USER3_KEY = 'f0c16b4c-0a0f-4b5f-8e66-33b1c1fce0b3';

        const fixtures = {
            '"user"."users"': [
                {
                    key: USER1_KEY,
                    email: 'demo1@matchingDomain.com',
                },
                {
                    key: USER2_KEY,
                    email: 'demo2@matchingDomain.com',
                },
                {
                    key: USER3_KEY,
                    email: 'demo3@nonMatchingDomain.com',
                },
            ],
        };

        before(async function () {
            await loadFixtures(fixtures);
            h.newScope();
        });

        after(async function () {
            h.prevScope();
            await h.revertChanges();
        });

        it('works', async function () {
            const userHasPermissionTo = (sourceUser, targetUser) =>
                permission.userHasAllPermissions({realKey: sourceUser}, [
                    {
                        resourceGroup: 'user',
                        resourceType: 'user',
                        resourceKey: [targetUser],
                        permission: 'view',
                    },
                ]);

            await ensurePermissionsAreGenerated();
            assert.isFalse(await userHasPermissionTo(USER1_KEY, USER2_KEY));
            assert.isFalse(await userHasPermissionTo(USER2_KEY, USER1_KEY));
            assert.isFalse(await userHasPermissionTo(USER1_KEY, USER3_KEY));
            assert.isFalse(await userHasPermissionTo(USER2_KEY, USER3_KEY));
            assert.isFalse(await userHasPermissionTo(USER3_KEY, USER1_KEY));
            assert.isFalse(await userHasPermissionTo(USER3_KEY, USER2_KEY));
        });
    });

    describe('demo__application', function () {
        const USER_KEY = 'f0c16b4c-0a0f-4b5f-8e66-33b1c1fce0b1';
        const APPLICATION_GROUP = 'df424e7d-edd3-400d-8641-ad70e655af01';
        const APPLICATION_KEY = '27004996-f21b-4571-b5f1-5083a9b85ad1';
        const CASE_KEY = '315b5e2d-1bff-4093-ab30-6089f111b8f2';

        const fixtures = {
            '"user"."users"': [
                {
                    key: USER_KEY,
                },
            ],
            '"user"."groups"': [
                {
                    key: APPLICATION_GROUP,
                    name: `generated:demo:application:${APPLICATION_KEY}`,
                },
            ],
            '"application"."application"': [
                {
                    key: APPLICATION_KEY,
                },
            ],
            '"metadata"."case"': [
                {
                    key: CASE_KEY,
                },
            ],
        };

        before(async function () {
            await loadFixtures(fixtures);
            h.newScope();
        });

        after(async function () {
            h.prevScope();
            await h.revertChanges();
        });

        it('works', async function () {
            const hasPermission = () =>
                permission.userHasAllPermissions({realKey: USER_KEY}, [
                    {
                        resourceGroup: 'metadata',
                        resourceType: 'case',
                        resourceKey: [CASE_KEY],
                        permission: 'view',
                    },
                    {
                        resourceGroup: 'metadata',
                        resourceType: 'case',
                        resourceKey: [CASE_KEY],
                        permission: 'create',
                    },
                    {
                        resourceGroup: 'metadata',
                        resourceType: 'case',
                        resourceKey: [CASE_KEY],
                        permission: 'update',
                    },
                    {
                        resourceGroup: 'metadata',
                        resourceType: 'case',
                        resourceKey: [CASE_KEY],
                        permission: 'delete',
                    },
                ]);

            await assingGroup(USER_KEY, APPLICATION_GROUP);
            await ensurePermissionsAreGenerated();

            // guard
            assert.isFalse(await hasPermission());

            // create application relation
            await h.createRecord('"relations"."caseRelation"', {
                key: '73493df1-6890-46bb-bbd2-e8b907753917',
                parentCaseKey: CASE_KEY,
                applicationKey: APPLICATION_KEY,
            });
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // delete application relation
            await db.query(
                `DELETE FROM "relations"."caseRelation" WHERE "key" = '73493df1-6890-46bb-bbd2-e8b907753917'`
            );
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());
        });
    });
});
