const {SQL} = require('sql-template-strings');
const qb = require('@imatic/pgqb');
const db = require('../../db');
const _ = require('lodash/fp');
const fn = require('../../fn');

const flatMapWithKey = _.flatMap.convert({cap: false});

const PERMISSION_SOURCE_OWNER = 'owner';

/**
 * @param {number} eventId
 * @param {string[]} tables
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function ownerChangesSinceQuery(eventId, tables) {
    return qb.merge(
        qb.select([
            '"la"."event_id"',
            '"la"."schema_name"',
            '"la"."table_name"',
            '"la"."action"',
            '"la"."row_data"',
        ]),
        qb.from('"audit"."logged_actions"', '"la"'),
        qb.where(
            qb.expr.and(
                qb.expr.gt('"la"."event_id"', qb.val.inlineParam(eventId)),
                qb.expr.neq('"la"."action"', qb.val.inlineParam('U')),
                qb.expr.neq('"la"."action"', qb.val.inlineParam('I')),
                qb.expr.in(
                    '"la"."table_name"',
                    tables.map((t) => qb.val.inlineParam(t))
                )
            )
        )
    );
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
                qb.expr.eq('la.table_name', qb.val.inlineParam('userGroups'))
            )
        ),
        qb.orderBy('la.event_id')
    );
}

/**
 * @param {number} eventId
 * @param {import('./compiler').Targets} opts
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

/**
 * @param {import('pg').Client} client
 * @param {import('@imatic/pgqb').Sql} sqlMap
 *
 * @returns {AsyncGenerator}
 */
async function* runAuditQuery(client, sqlMap) {
    const limit = 100;
    let offset = 0;

    while (true) {
        const rows = await client
            .query(
                qb.toSql(qb.merge(sqlMap, qb.limit(limit), qb.offset(offset)))
            )
            .then((res) => res.rows);

        for (let row of rows) {
            yield row;
        }

        if (rows.length < limit) {
            return;
        }

        offset += limit;
    }
}

/**
 * @param {import('pg').Client} client
 * @param {import('./compiler').Permissions} permissions
 *
 * @returns {Promise}
 */
async function initPermissions(client, permissions) {
    if (_.size(permissions) === 0) {
        return;
    }

    const staleSqlMap = qb.merge(
        qb.update('public.generatedPermissions'),
        qb.set([qb.expr.eq('active', qb.val.inlineParam(false))]),
        qb.where(
            qb.expr.not(
                qb.expr.or(
                    ..._.map(
                        ([name, p]) =>
                            qb.expr.and(
                                qb.expr.eq('name', qb.val.inlineParam(name)),
                                qb.expr.eq(
                                    'config_hash',
                                    qb.val.inlineParam(p.hash)
                                )
                            ),
                        Object.entries(permissions)
                    )
                )
            )
        )
    );

    const sqlMap = qb.merge(
        qb.insertInto('public.generatedPermissions'),
        qb.columns(['name', 'last_event', 'config_hash']),
        qb.values(
            _.map(
                ([name, p]) => [
                    qb.val.inlineParam(name),
                    qb.val.inlineParam(0),
                    qb.val.inlineParam(p.hash),
                ],
                Object.entries(permissions)
            )
        ),
        qb.onConflict(['name', 'config_hash']),
        qb.doUpdate([qb.expr.eq('active', qb.val.inlineParam(true))])
    );

    await Promise.all([
        client.query(qb.toSql(sqlMap)),
        client.query(qb.toSql(staleSqlMap)),
    ]);
}

/**
 * @param {Client} client
 * @param {string} name
 * @param {number} lastEvent
 *
 * @returns {Promise}
 */
async function updatePermissionProgress(client, name, lastEvent) {
    const sqlMap = qb.merge(
        qb.update('public.generatedPermissions'),
        qb.set([qb.expr.eq('last_event', qb.val.inlineParam(lastEvent))]),
        qb.where(
            qb.expr.eq('name', qb.val.inlineParam(name)),
            qb.expr.eq('active', qb.val.inlineParam(true))
        )
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
        qb.where(
            qb.expr.and(
                qb.expr.eq('gp.name', qb.val.inlineParam(name)),
                qb.expr.eq('gp.active', qb.val.inlineParam(true))
            )
        )
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
            qb.expr.or(
                ..._.map(
                    (p) =>
                        qb.expr.and(
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
 */
async function clearStalePermissions(client) {
    const inactiveSqlMap = qb.merge(
        qb.select(['name', 'config_hash']),
        qb.from('public.generatedPermissions'),
        qb.where(qb.expr.eq('active', qb.val.inlineParam(false)))
    );

    const res = await client.query(qb.toSql(inactiveSqlMap));
    await Promise.all(
        res.rows.map((row) =>
            deleteAllGroupPermissions(
                client,
                createPermissionSource(row.name, row.config_hash)
            )
        )
    );

    const staleUserPermissionsSql = `DELETE FROM "user"."userPermissions"
WHERE
  ARRAY_LENGTH("permissionSources", 1) IS NULL`;
    const staleGroupPermissionsSql = `DELETE FROM "user"."groupPermissions"
WHERE
  ARRAY_LENGTH("permissionSources", 1) IS NULL`;

    const staleGeneratedPermissionsSql = `DELETE FROM "public"."generatedPermissions" WHERE "active" = false`;

    await Promise.all([
        client.query(staleUserPermissionsSql),
        client.query(staleGroupPermissionsSql),
        client.query(staleGeneratedPermissionsSql),
    ]);
}

/**
 * @param {import('pg').Client} client
 * @param {string} userKey
 * @param {Promise<string[]>} permissionKeys
 * @param {string} permissionSource
 */
async function ensureUserPermissions(
    client,
    userKey,
    permissionKeys,
    permissionSource
) {
    if (userKey == null || permissionKeys.length === 0) {
        return;
    }

    const values = permissionKeys.map((pk) => [
        qb.val.inlineParam(userKey),
        qb.val.inlineParam(pk),
        qb.val.inlineParam([permissionSource]),
    ]);

    const sqlMap = qb.merge(
        qb.insertInto('"user"."userPermissions"'),
        qb.columns(['"userKey"', '"permissionKey"', '"permissionSources"']),
        qb.values(values),
        qb.onConflict(['"userKey"', '"permissionKey"']),
        qb.doUpdate([
            qb.val.raw(
                SQL`"permissionSources" = (SELECT ARRAY(SELECT DISTINCT "e" FROM UNNEST(ARRAY_APPEND("user"."userPermissions"."permissionSources", ${permissionSource})) "e"))`
            ),
        ])
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {import('pg').Client} client
 * @param {string} resourceGroup
 * @param {string} resourceType
 * @param {string} resourceKey
 *
 * @returns {Promise}
 */
async function deletePermissions(
    client,
    resourceGroup,
    resourceType,
    resourceKey
) {
    await client.query(
        SQL`DELETE FROM "user"."permissions" WHERE "resourceGroup" = ${resourceGroup} AND "resourceType" = ${resourceType} AND "resourceKey" = ${resourceKey}`
    );
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groupKeys
 * @param {Promise<string[]>} permissionKeys
 * @param {string} permissionSource
 */
async function ensureGroupsPermissions(
    client,
    groupKeys,
    permissionKeys,
    permissionSource
) {
    if (groupKeys.length === 0 || permissionKeys.length === 0) {
        return;
    }

    const values = _.flatMap(
        (gk) =>
            _.map(
                (pk) => [
                    qb.val.inlineParam(gk),
                    qb.val.inlineParam(pk),
                    qb.val.inlineParam([permissionSource]),
                ],
                permissionKeys
            ),
        groupKeys
    );

    const sqlMap = qb.merge(
        qb.insertInto('user.groupPermissions'),
        qb.columns(['groupKey', 'permissionKey', 'permissionSources']),
        qb.values(values),
        qb.onConflict(['groupKey', 'permissionKey']),
        qb.doUpdate([
            qb.val.raw(
                SQL`"permissionSources" = (SELECT ARRAY(SELECT DISTINCT "e" FROM UNNEST(ARRAY_APPEND("user"."groupPermissions"."permissionSources", ${permissionSource})) "e"))`
            ),
        ])
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
 * @param {string} permissionSource
 *
 * @returns {Promise}
 */
async function deleteAllGroupPermissions(client, permissionSource) {
    const sqlMap = qb.merge(
        qb.update('user.groupPermissions'),
        qb.set([
            qb.expr.eq(
                'permissionSources',
                qb.expr.fn(
                    'ARRAY_REMOVE',
                    'permissionSources',
                    qb.val.inlineParam(permissionSource)
                )
            ),
        ])
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} groupKeys
 * @param {string[]} permissionKeys
 * @param {string} permissionSource
 *
 * @returns {Promise}
 */
async function deleteGroupsPermissions(
    client,
    groupKeys,
    permissionKeys,
    permissionSource
) {
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

    const sqlMap = qb.merge(
        qb.update('user.groupPermissions'),
        qb.set([
            qb.expr.eq(
                'permissionSources',
                qb.expr.fn(
                    'ARRAY_REMOVE',
                    'permissionSources',
                    qb.val.inlineParam(permissionSource)
                )
            ),
        ]),
        qb.where(condition)
    );

    await client.query(qb.toSql(sqlMap));
}

/**
 * @param {import('../rest/compiler').Plan} plan
 *
 * @returns {Object<string, Object<string, string>>}
 */
function createTableToTypeMapping(plan) {
    return _.mapValues((groupData) => {
        return _.zipObj(
            _.map((type) => type.table, groupData),
            _.keys(groupData)
        );
    }, plan);
}

/**
 * @param {string} name
 * @param {string} hash
 *
 * @returns {string}
 */
function createPermissionSource(name, hash) {
    return 'generated:' + name + ':' + hash;
}

/**
 * @param {{data: object, permission: Permission, action: object, tableToType: Object<string, Object<string, string>>}} context
 *
 * @returns {{resourceGroup: string, resourceType: string, resourceKey: string}}
 */
function permissionTarget({data, permission, action, tableToType}) {
    const actionType = _.getOr(
        action.table_name,
        [action.schema_name, action.table_name],
        tableToType
    );
    const currentTarget = permission.targets[action.schema_name][actionType];

    if (currentTarget.targetType == null) {
        return {
            resourceGroup: action.schema_name,
            resourceType: actionType,
            resourceKey: data.key,
        };
    }

    const targetType = currentTarget.targetType;
    const targetKey = _.get(targetType.resourceKeyPath, data);

    if (targetKey == null) {
        return null;
    }

    return {
        resourceGroup: targetType.resourceGroup,
        resourceType: targetType.resourceType,
        resourceKey: targetKey,
    };
}

/**
 * @param {{client: import('pg').Client,  tableToType: Object<string, Object<string, string>>}} context
 * @param {{permission: import('./compiler').Permission, name: string}} params
 *
 * @returns {Promise}
 */
async function manageGroups({client, tableToType}, {permission, name}) {
    const permissionSource = createPermissionSource(name, permission.hash);
    const eventId = await lastPermissionEvent(client, name);
    for await (let action of runAuditQuery(
        client,
        columnChangesSinceQuery(eventId, permission.targets)
    )) {
        const shouldAssigngroup = permission.assignGroup === true;
        switch (action.action) {
            case 'I':
                {
                    const currentData = action.row_data;
                    const newGroup = permission.groupName(currentData);
                    if (newGroup == null) {
                        continue;
                    }

                    const permissionType = permissionTarget({
                        tableToType,
                        data: currentData,
                        permission,
                        action,
                    });

                    if (permissionType == null) {
                        continue;
                    }

                    const requiredPermissions = permission.targetPermissions;
                    const permissions = _.map(
                        (perm) =>
                            Object.assign({}, permissionType, {
                                permission: perm,
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
                            permissionKeys,
                            permissionSource
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
                    const currentData = Object.assign(
                        {},
                        action.row_data,
                        action.changed_fields
                    );

                    const oldGroup = permission.groupName(oldData);
                    const newGroup = permission.groupName(currentData);
                    if (oldGroup !== newGroup) {
                        const permissionType = permissionTarget({
                            tableToType,
                            data: currentData,
                            permission,
                            action,
                        });

                        if (permissionType == null) {
                            throw new Error(
                                `It is not supported to remove relation data by update. Action: ${JSON.stringify(
                                    action
                                )}`
                            );
                        }

                        const requiredPermissions =
                            permission.targetPermissions;
                        const permissions = _.map(
                            (perm) =>
                                Object.assign({}, permissionType, {
                                    permission: perm,
                                }),
                            requiredPermissions
                        );

                        const [groupKeys, permissionKeys, oldGroupKeys] =
                            await Promise.all([
                                ensureGroups(client, [newGroup]),
                                ensurePermissions(client, permissions),
                                groupKeys(client, [oldGroup]),
                            ]);

                        await Promise.all([
                            deleteGroupsPermissions(
                                client,
                                oldGroupKeys,
                                permissionKeys,
                                permissionSource
                            ),
                            ensureGroupsPermissions(
                                client,
                                groupKeys,
                                permissionKeys,
                                permissionSource
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
            case 'D':
                {
                    const oldData = action.row_data;
                    const oldGroup = permission.groupName(oldData);
                    if (oldGroup == null) {
                        continue;
                    }

                    const permissionType = permissionTarget({
                        tableToType,
                        data: oldData,
                        permission,
                        action,
                    });

                    if (permissionType == null) {
                        continue;
                    }

                    const requiredPermissions = permission.targetPermissions;
                    const permissions = _.map(
                        (perm) =>
                            Object.assign({}, permissionType, {
                                permission: perm,
                            }),
                        requiredPermissions
                    );

                    const [oldGroupKeys, permissionKeys] = await Promise.all([
                        ensureGroups(client, [oldGroup]),
                        ensurePermissions(client, permissions),
                    ]);

                    await Promise.all([
                        deleteGroupsPermissions(
                            client,
                            oldGroupKeys,
                            permissionKeys,
                            permissionSource
                        ),
                        ..._.map(
                            (k) => unassignGroup(client, oldData.key, k),
                            shouldAssigngroup ? oldGroupKeys : []
                        ),
                    ]);
                }
                break;
        }

        await updatePermissionProgress(client, name, action.event_id);
    }
}

/**
 * @param {import('pg').Client} client
 * @param {string[]} names
 *
 * @returns {Promise<{key: string, name: string}>}
 */
function groups(client, names) {
    if (names.length === 0) {
        return [];
    }

    const sqlMap = qb.merge(
        qb.select(['key', 'name']),
        qb.from('user.groups'),
        qb.where(qb.expr.in('name', _.map(qb.val.inlineParam, names)))
    );

    return client.query(qb.toSql(sqlMap)).then(_.get('rows'));
}

/**
 * @param {import('pg').Client} client
 * @param {import('./compiler').ColumnsPermission} permission
 *
 * @returns {Promise<{{sourceGroups: string[], targetGroups: []}}>}
 */
async function permissionGroups(client, permission) {
    const groupRows = await groups(
        client,
        _.uniq(_.concat(permission.sourceGroups, permission.targetGroups))
    );
    const groupIdByName = _.zipObj(
        _.map(_.prop('name'), groupRows),
        _.map(_.prop('key'), groupRows)
    );

    const convertGroups = _.flow(
        _.map((name) => groupIdByName[name]),
        _.filter((id) => id != null)
    );

    return {
        sourceGroups: convertGroups(permission.sourceGroups),
        targetGroups: convertGroups(permission.targetGroups),
    };
}

/**
 * @param {{client: import('pg').Client}} context
 * @param {{permission: import('./compiler').Permission, name: string}} params
 *
 * @returns {Promise}
 */
async function manageGroups2({client}, {permission, name}) {
    const permissionSource = createPermissionSource(name, permission.hash);
    const {sourceGroups, targetGroups} = await permissionGroups(
        client,
        permission
    );
    if (sourceGroups.length === 0 || targetGroups.length === 0) {
        return;
    }

    const eventId = await lastPermissionEvent(client, name);
    for await (let action of runAuditQuery(
        client,
        groupChangesSinceQuery(eventId)
    )) {
        switch (action.action) {
            case 'I':
                {
                    const currentData = action.row_data;
                    if (_.includes(currentData.groupKey, targetGroups)) {
                        const requiredPermissions =
                            permission.targetPermissions;
                        const permissions = _.map(
                            (perm) => ({
                                permission: perm,
                                resourceKey: currentData.userKey,
                                resourceType: 'user',
                                resourceGroup: 'user',
                            }),
                            requiredPermissions
                        );

                        const permissionKeys = await ensurePermissions(
                            client,
                            permissions
                        );
                        await ensureGroupsPermissions(
                            client,
                            sourceGroups,
                            permissionKeys,
                            permissionSource
                        );
                    }
                }
                break;
            case 'D':
                {
                    const oldData = action.row_data;
                    if (_.includes(oldData.groupKey, targetGroups)) {
                        const requiredPermissions =
                            permission.targetPermissions;
                        const permissions = _.map(
                            (perm) => ({
                                permission: perm,
                                resourceKey: oldData.userKey,
                                resourceType: 'user',
                                resourceGroup: 'user',
                            }),
                            requiredPermissions
                        );
                        const pKeys = await permissionKeys(client, permissions);
                        await deleteGroupsPermissions(
                            client,
                            sourceGroups,
                            pKeys,
                            permissionSource
                        );
                    }
                }
                break;
            case 'T':
                deleteAllGroupPermissions(client, permissionSource);
                break;
        }
        await updatePermissionProgress(client, name, action.event_id);
    }
}

/**
 * @param {{client: import('pg').Client, group: string, type: string}} context
 * @param {string} userKey
 * @param {string[]} typeKeys
 */
async function ensureOwnerPermissions(
    {client, group, type},
    userKey,
    typeKeys
) {
    const requiredPermissions = ['view', 'update', 'delete'];

    const permissionKeys = await ensurePermissions(
        client,
        typeKeys.flatMap((key) =>
            requiredPermissions.map((p) => ({
                resourceGroup: group,
                resourceType: type,
                resourceKey: key,
                permission: p,
            }))
        )
    );

    await ensureUserPermissions(
        client,
        userKey,
        permissionKeys,
        PERMISSION_SOURCE_OWNER
    );
}

/**
 * @param {{client: import('pg').Client,  tableToType: Object<string, Object<string, string>>}} context
 * @param {{permission: {hash: string}, name: string}} params
 */
async function manageOwners({client, tableToType}, {name}) {
    const eventId = await lastPermissionEvent(client, name);
    const tables = Object.values(tableToType).flatMap((v) => Object.keys(v));
    for await (let action of runAuditQuery(
        client,
        ownerChangesSinceQuery(eventId, tables)
    )) {
        if (
            (tableToType[action.schema_name] || {})[action.table_name] == null
        ) {
            await updatePermissionProgress(client, name, action.event_id);
            continue; // not managed type
        }

        const actionType = _.getOr(
            action.table_name,
            [action.schema_name, action.table_name],
            tableToType
        );
        switch (action.action) {
            // 'I' is called on creation so that response contains proper permissions
            case 'D':
                {
                    await deletePermissions(
                        client,
                        action.schema_name,
                        actionType,
                        action.row_data.key
                    );
                }
                break;
        }
        await updatePermissionProgress(client, name, action.event_id);
    }
}

/**
 * @param {{plan: import('../rest/compiler').Plan, client: import('pg').Client}} context
 *
 * @returns {Promise}
 */
async function process({plan, generatedPermissions, client}) {
    const allPermissions = Object.assign({}, generatedPermissions, {
        [PERMISSION_SOURCE_OWNER]: {hash: 'v1'},
    });
    await db.obtainPermissionsLock(client);
    try {
        const tableToType = createTableToTypeMapping(plan);
        await initPermissions(client, allPermissions);
        for (let [name, permission] of Object.entries(allPermissions)) {
            await db.transaction(client, async function (client) {
                if (
                    permission.targets != null &&
                    permission.groupName != null &&
                    permission.targetPermissions != null
                ) {
                    await manageGroups(
                        {client, tableToType},
                        {permission, name}
                    );
                }

                if (
                    permission.sourceGroups != null &&
                    permission.targetGroups != null &&
                    permission.targetPermissions != null
                ) {
                    await manageGroups2({client}, {permission, name});
                }

                if (name === PERMISSION_SOURCE_OWNER) {
                    await manageOwners(
                        {client, tableToType},
                        {permission, name}
                    );
                }

                await clearStalePermissions(client);
            });
        }
    } finally {
        await db.releasePermissionsLock(client);
    }
}

/**
 * Generates permissions based on current db state.
 */
async function runOnce({plan, generatedPermissions}) {
    const client = await db.connect();
    try {
        await process({plan, generatedPermissions, client});
    } finally {
        client.release();
    }
}

/**
 * Generates permissions based on current db state as `runOnce` does
 * + reruns the generation on db changes.
 */
async function run({plan, generatedPermissions}) {
    const client = await db.connect();
    const queuedProcess = fn.queued(() =>
        process({plan, generatedPermissions, client})
    );
    client.on('notification', function () {
        queuedProcess();
    });
    client.query('LISTEN audit_action');
    await queuedProcess();
}

module.exports = {
    run,
    runOnce,
    ensureOwnerPermissions,
};
