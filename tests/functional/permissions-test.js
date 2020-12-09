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
    describe('demo__target_group', function () {
        const appConfig = getAppConfig();
        const ensurePermissionsAreGenerated = () =>
            permissions.runOnce({
                plan: appConfig.plan,
                generatedPermissions: appConfig.generatedPermissions,
            });

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

            const assingGroup = (user, group) =>
                db.query(
                    'INSERT INTO "user"."userGroups"("userKey", "groupKey") VALUES($1, $2)',
                    [user, group]
                );

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
            assert.isTrue(await hasPermission());

            // unassign source group
            await unassignGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());

            // assign source group
            await assingGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isTrue(await hasPermission());

            // unassign target group
            await unassignGroup(USER1_KEY, SOURCE_GROUP_KEY);
            await ensurePermissionsAreGenerated();
            assert.isFalse(await hasPermission());
        });
    });

    // describe('demo__email_domain', function () {});

    // describe('demo__application', function () {});
});
