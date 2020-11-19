const {SQL} = require('sql-template-strings');
const qb = require('@imatic/pgqb');
const db = require('../../db');
const _ = require('lodash/fp');

/**
 * @typedef {Object<string, Object<string, {table: string, columns: string[]}>>} Targets
 *
 * @typedef ColumnsPermission
 * @property {Targets} targets
 * @property {(data: object) => string} groupName
 * @property {string[]} targetPermissions
 *
 * @typedef {ColumnsPermission} Permission
 *
 * @typedef {Object<string, Permission>} Permissions
 */

const flatMapWithKey = _.flatMap.convert({cap: false});
const mapValuesWithKey = _.mapValues.convert({cap: false});

/**
 * Permission
 * - targets - types to which `targetPermissions` will be assignled
 * - targetPermissions - permissions to assign to `targets`
 * - groupName - permission will be assigned to returned specified group
 * - userKey - returned user will be assigned to the returned group
 */
const generatedPermissions = {
    target_group: {
        sourceGroups: ['group1'],
        targetGroups: ['targetGroup'],
        targetPermissions: ['view'],
    },
    email_domain: {
        targets: {
            user: {
                user: {columns: ['email']},
            },
        },
        groupName: ({email}) => {
            return (
                'generated:email_domain:' +
                (email == null ? '' : email).match(/[^@]*$/)
            );
        },
        assignGroup: true, // target needs to be user type
        targetPermissions: ['view'],
    },
    application: {
        targets: {
            // todo: generate targets from plan
            relations: {
                spatial: {columns: ['applicationKey']},
                attribute: {columns: ['applicationKey']},
            },
        },
        groupName: ({applicationKey}) => {
            return `generated:application:${applicationKey}`;
        },
        targetPermissions: ['view', 'create', 'update', 'delete'],
    },
};

/**
 * @param {{plan: import('../rest/compiler').Plan}} context
 * @param {Permissions} permissions
 *
 * @returns {Permissions}
 */
function compilePermissions({plan}, permissions) {
    return _.mapValues((permission) => {
        if (permission.targets == null) {
            return permission;
        }

        return _.update(
            'targets',
            (targets) =>
                mapValuesWithKey((groupData, group) => {
                    return mapValuesWithKey((typeData, type) => {
                        return _.set(
                            'table',
                            plan[group][type].table,
                            typeData
                        );
                        return typeData;
                    }, groupData);
                }, targets),
            permission
        );
    }, permissions);
}

/**
 * @param {number} eventId
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function groupChangesSinceQuery(eventId) {
    return qb.merge(
        qb.select([
            'la.event_id',
            'la.schema_name',
            'la.table_name',
            'la.action',
            'la.row_data',
            'la.changed_fields',
        ]),
        qb.from('audit.logged_actions', 'la'),
        qb.where(
            qb.expr.and(
                qb.expr.gt('la.event_id', qb.val.inlineParam(eventId)),
                qb.expr.eq('la.schema_name', qb.val.inlineParam('user')),
                qb.expr.eq('la.table_name', qb.val.inlineParam('groups'))
            )
        ),
        qb.orderBy('la.event_id')
    );
}

/**
 * @param {number} eventId
 * @param {Targets} opts
 */
function columnChangesSinceQuery(eventId, targets) {
    const targetExpr = qb.expr.or(
        ...flatMapWithKey((groupData, group) => {
            return _.map(({table}) => {
                return qb.expr.and(
                    qb.expr.eq('la.schema_name', qb.val.inlineParam(group)),
                    qb.expr.eq('la.table_name', qb.val.inlineParam(table))
                );
            }, groupData);
        }, targets)
    );

    return qb.merge(
        qb.select([
            'la.event_id',
            'la.schema_name',
            'la.table_name',
            'la.action',
            'la.row_data',
            'la.changed_fields',
        ]),
        qb.from('audit.logged_actions', 'la'),
        qb.where(
            qb.expr.and(
                qb.expr.gt('la.event_id', qb.val.inlineParam(eventId)),
                targetExpr
            )
        ),
        qb.orderBy('la.event_id')
    );
}

async function* runAuditQuery(sqlMap) {
    const limit = 100;
    let offset = 0;

    while (true) {
        const rows = await db
            .query(
                qb.toSql(qb.merge(sqlMap, qb.limit(limit), qb.offset(offset)))
            )
            .then((res) => res.rows);

        for (row of rows) {
            yield row;
        }

        if (rows.length < limit) {
            return;
        }

        offset += limit;
    }
}

/**
 *
 * @param {import('pg').Client} client
 * @param {Permissions} permissions
 */
async function initPermissions(client, permissions) {
    const names = _.keys(permissions);
    if (names.length === 0) {
        return;
    }

    const sqlMap = qb.merge(
        qb.insertInto('public.generatedPermissions'),
        qb.columns(['name', 'last_event']),
        qb.values(
            _.map(
                (name) => [qb.val.inlineParam(name), qb.val.inlineParam(0)],
                names
            )
        ),
        qb.onConflict(['name']),
        qb.doNothing()
    );

    await client.query(qb.toSql(sqlMap));
}

async function updatePermissionProgress(client, name, lastEvent) {
    const sqlMap = qb.merge(
        qb.update('public.generatedPermissions'),
        qb.set([qb.expr.eq('last_event', qb.val.inlineParam(lastEvent))]),
        qb.where(qb.expr.eq('name', qb.val.inlineParam(name)))
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {import('pg').Client} client
 * @param {string} name
 *
 * @returns {number}
 */
function lastPermissionEvent(client, name) {
    const sqlMap = qb.merge(
        qb.select(['gp.last_event']),
        qb.from('public.generatedPermissions', 'gp'),
        qb.where(qb.expr.eq('gp.name', qb.val.inlineParam(name)))
    );

    return client
        .query(qb.toSql(sqlMap))
        .then(_.getOr(0, ['rows', 0, 'last_event']));
}

/**
 * @param {import('pg').Client} client
 * @param {{resourceKey: string, resourceType: string, resourceGroup: string, permission: string}[]} permissions
 *
 * @returns {Promise<string[]>}
 */
function permissionKeys(client, permissions) {
    if (permissions.length === 0) {
        return [];
    }

    const columns = [
        'resourceGroup',
        'resourceType',
        'resourceKey',
        'permission',
    ];

    const selectSqlMap = qb.merge(
        qb.select(['key']),
        qb.from('user.permissions'),
        qb.where(
            qb.expr.and(
                ..._.map(
                    (p) =>
                        qb.expr.or(
                            ..._.map(
                                (c) =>
                                    qb.expr.eq(
                                        c,
                                        qb.val.inlineParam(_.get(c, p))
                                    ),
                                columns
                            )
                        ),
                    permissions
                )
            )
        )
    );

    return client
        .query(qb.toSql(selectSqlMap))
        .then((res) => _.map(_.get('key'), res.rows));
}

/**
 * @param {import('pg').Client} client
 * @param {{resourceKey: string, resourceType: string, resourceGroup: string, permission: string}[]} permissions
 *
 * @returns {Promise<string[]>}
 */
async function ensurePermissions(client, permissions) {
    if (permissions.length === 0) {
        return [];
    }

    const columns = [
        'resourceGroup',
        'resourceType',
        'resourceKey',
        'permission',
    ];

    const insertSqlMap = qb.merge(
        qb.insertInto('user.permissions'),
        qb.columns(columns),
        qb.values(
            _.map(
                (p) => _.map((c) => qb.val.inlineParam(_.get(c, p)), columns),
                permissions
            )
        ),
        qb.onConflict(columns),
        qb.doNothing()
    );

    await client.query(qb.toSql(insertSqlMap));

    return permissionKeys(client, permissions);
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groups
 *
 * @returns {string[]}
 */
function groupKeys(client, groups) {
    if (groups.length === 0) {
        return [];
    }

    const selectSqlMap = qb.merge(
        qb.select(['key']),
        qb.from('user.groups'),
        qb.where(qb.expr.in('name', _.map(qb.val.inlineParam, groups)))
    );

    return client
        .query(qb.toSql(selectSqlMap))
        .then((res) => _.map(_.get('key'), res.rows));
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groups
 *
 * @returns {string[]}
 */
async function ensureGroups(client, groups) {
    if (groups.length === 0) {
        return [];
    }

    const insertSqlMap = qb.merge(
        qb.insertInto('user.groups'),
        qb.columns(['name']),
        qb.values(_.map((g) => [qb.val.inlineParam(g)], groups)),
        qb.onConflict(['name']),
        qb.doNothing()
    );

    await client.query(qb.toSql(insertSqlMap));

    return groupKeys(client, groups);
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groupKeys
 * @param {Promise<string[]>} permissionKeys
 */
async function ensureGroupsPermissions(client, groupKeys, permissionKeys) {
    if (groupKeys.length === 0 || permissionKeys.length === 0) {
        return;
    }

    const values = _.flatMap(
        (gk) =>
            _.map(
                (pk) => [qb.val.inlineParam(gk), qb.val.inlineParam(pk)],
                permissionKeys
            ),
        groupKeys
    );

    const sqlMap = qb.merge(
        qb.insertInto('user.groupPermissions'),
        qb.columns(['groupKey', 'permissionKey']),
        qb.values(values),
        qb.onConflict(['groupKey', 'permissionKey']),
        qb.doNothing()
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {import('pg').Client} client
 * @param {string} userKey
 * @param {string} groupKey
 */
async function assignGroup(client, userKey, groupKey) {
    const sql = SQL`INSERT INTO "user"."userGroups"
  ("userKey", "groupKey")
    (
SELECT
  "u"."key", ${groupKey}
FROM
  "user"."users" "u"
WHERE
  "u"."key" = ${userKey}
)
ON CONFLICT DO NOTHING`;

    await client.query(sql);
}

/**
 * @param {import('pg').Client} client
 * @param {string} userKey
 * @param {string} groupKey
 */
async function unassignGroup(client, userKey, groupKey) {
    await client.query(SQL`DELETE FROM
  "user"."userGroups"
WHERE
  "userKey" = ${userKey}
  AND "groupKey" = ${groupKey}`);
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groupKeys
 * @param {string[]} permissionKeys
 */
async function deleteGroupsPermissions(client, groupKeys, permissionKeys) {
    if (groupKeys.length === 0 || permissionKeys.length === 0) {
        return;
    }

    const condition = qb.expr.or(
        ..._.flatMap(
            (gk) =>
                _.map(
                    (pk) =>
                        qb.expr.and(
                            qb.expr.eq('groupKey', qb.val.inlineParam(gk)),
                            qb.expr.eq('permissionKey', qb.val.inlineParam(pk))
                        ),
                    permissionKeys
                ),
            groupKeys
        )
    );

    const whereClause = qb.toSql(qb.where(condition));

    await client.query(
        SQL`DELETE FROM "user"."groupPermissions `.append(whereClause)
    );
}

/**
 * @param {import('../rest/compiler').Plan} plan
 *
 * @returns {Object<string, string>}
 */
function createTableToTypeMapping(plan) {
    return _.mergeAll(
        _.map((groupData) => {
            return _.zipObj(
                _.map((type) => type.table, groupData),
                _.keys(groupData)
            );
        }, plan)
    );
}

async function manageGroups({client, tableToType}, {permission, name}) {
    const eventId = await lastPermissionEvent(client, name);
    for await (let action of runAuditQuery(
        columnChangesSinceQuery(eventId, permission.targets)
    )) {
        const shouldAssigngroup = permission.assignGroup === true;
        switch (action.action) {
            case 'I':
                {
                    const currentData = action.row_data;
                    const newGroup = permission.groupName(currentData);
                    const requiredPermissions = permission.targetPermissions;
                    const permissions = _.map(
                        (perm) => ({
                            permission: perm,
                            resourceKey: currentData.key,
                            resourceType: tableToType[action.table_name],
                            resourceGroup: action.schema_name,
                        }),
                        requiredPermissions
                    );

                    const [groupKeys, permissionKeys] = await Promise.all([
                        ensureGroups(client, [newGroup]),
                        ensurePermissions(client, permissions),
                    ]);

                    await Promise.all([
                        ensureGroupsPermissions(
                            client,
                            groupKeys,
                            permissionKeys
                        ),
                        ..._.map(
                            (k) => assignGroup(client, currentData.key, k),
                            shouldAssigngroup ? groupKeys : []
                        ),
                    ]);
                }
                break;
            case 'U':
                {
                    const oldData = action.row_data;
                    const currentData = _.merge(
                        action.row_data,
                        action.changed_fields
                    );

                    const oldGroup = permission.groupName(oldData);
                    const newGroup = permission.groupName(currentData);
                    if (oldGroup !== newGroup) {
                        const permissions = _.map(
                            (perm) => ({
                                permission: perm,
                                resourceKey: currentData.key,
                                resourceType: tableToType[action.table_name],
                                resourceGroup: action.schema_name,
                            }),
                            requiredPermissions
                        );

                        const [
                            groupKeys,
                            permissionKeys,
                            oldGroupKeys,
                        ] = await Promise.all([
                            ensureGroups(client, [newGroup]),
                            ensurePermissions(client, permissions),
                            groupKeys(client, [oldGroup]),
                        ]);

                        await Promise.all([
                            deleteGroupsPermissions(
                                client,
                                oldGroupKeys,
                                permissionKeys
                            ),
                            ensureGroupsPermissions(
                                client,
                                groupKeys,
                                permissionKeys
                            ),
                            ..._.map(
                                (k) =>
                                    unassignGroup(client, currentData.key, k),
                                shouldAssigngroup ? oldGroupKeys : []
                            ),
                            ..._.map(
                                (k) => assignGroup(client, currentData.key, k),
                                shouldAssigngroup ? groupKeys : []
                            ),
                        ]);
                    }
                }
                break;
        }

        await updatePermissionProgress(client, name, action.event_id);
    }
}

async function process({plan, client}) {
    const tableToType = createTableToTypeMapping(plan);
    const permissions = compilePermissions({plan}, generatedPermissions);
    await initPermissions(client, permissions);
    for (let [name, permission] of Object.entries(permissions)) {
        if (
            permission.targets != null &&
            permission.groupName != null &&
            permission.targetPermissions != null
        ) {
            await manageGroups({client, tableToType}, {permission, name});
        }

        if (
            permission.sourceGroup != null &&
            permission.targetGroups != null &&
            permission.targetPermissions != null
        ) {
        }
    }
}

async function run() {
    const client = db.connect();
    await db.obtainPermissionsLock(client);
    client.on('notification', function (msg) {
        // process();
    });
    client.query('LISTEN audit_action'); // todo: write trigger
}

module.exports = {
    run,
    process,
};
