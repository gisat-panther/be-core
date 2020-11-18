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

const generatedPermissions = {
    // target_group: {
    //     sourceGroups: ['group1'], // this group will have permissions to users in target groups
    //     targetGroups: ['targetGroup'],
    //     targetPermissions: ['view'], // assigned permissions
    // },
    // email_domain: {
    //     targets: [{group: 'user', type: 'user', columns: ['email']}],
    //     groupName: ({email}) => {
    //         return (email == null ? '' : email).match(/[^@]*$/);
    //     },
    //     targetPermissions: ['view'],
    // },
    application: {
        targets: {
            // todo: generate targets from plan
            relations: {
                spatial: {columns: ['applicationKey']},
                attribute: {columns: ['applicationKey']},
            },
        },
        groupName: ({applicationKey}) => {
            return `generated_application:${applicationKey}`;
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
 * @returns {string[]}
 */
function ensurePermissions(client, permissions) {
    if (permissions.length === 0) {
        return [];
    }

    const columns = [
        'resourceGroup',
        'resourceType',
        'resourceKey',
        'permission',
    ];

    const sqlMap = qb.merge(
        qb.insertInto('user.permissions'),
        qb.columns(columns),
        qb.values(
            _.map(
                (p) => _.map((c) => qb.val.inlineParam(_.get(c, p)), columns),
                permissions
            )
        ),
        qb.onConflict(['resourceGroup', 'resourceType', 'resourceKey']),
        qb.doNothing(),
        qb.returning(['key'])
    );

    return client
        .query(qb.toSql(sqlMap))
        .then((res) => _.map(_.get('key'), res.rows));
}

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

async function process({plan, client}) {
    const tableToType = createTableToTypeMapping(plan);
    const permissions = compilePermissions({plan}, generatedPermissions);
    await initPermissions(client, permissions);
    for (let [name, permission] of Object.entries(permissions)) {
        const eventId = await lastPermissionEvent(client, name);
        for await (let action of runAuditQuery(
            columnChangesSinceQuery(eventId, permission.targets)
        )) {
            switch (action.action) {
                case 'I':
                    {
                        const currentData = action.row_data;
                        const requiredGroupMembership = permission.groupName(
                            currentData
                        );
                        const requiredPermissions =
                            permission.targetPermissions;
                        const permissions = _.map(
                            (perm) => ({
                                permission: perm,
                                resourceKey: currentData.key,
                                resourceType: tableToType[action.table_name],
                                resourceGroup: action.schema_name,
                            }),
                            requiredPermissions
                        );

                        const permissionKeys = await ensurePermissions(
                            client,
                            permissions
                        );
                        console.log('permissionKeys', permissionKeys);
                        // make sure group exists with specified permissions
                    }
                    break;
                case 'U':
                    {
                        const currentData = _.merge(
                            action.row_data,
                            action.changed_fields
                        );

                        // like insert, but remove previous group membership
                    }
                    break;
            }

            await updatePermissionProgress(client, name, action.event_id);
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
