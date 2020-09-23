const parameters = require('../../middlewares/parameters');
const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const createDependentTypeMiddleware = require('./middlewares/dependentType');
const permission = require('../../permission');
const _ = require('lodash');
const schema = require('./schema');
const q = require('./query');
const db = require('../../db');
const util = require('./util');

/**
 * @typedef {Object} Permissions
 * @property {boolean} view
 * @property {boolean} create
 * @property {boolean} update
 * @property {boolean} delete
 *
 * @typedef {Object} Row
 * @property {string} key
 * @property {object} data
 * @property {{guest: Permissions, activeUser: Permissions}} permissions
 */

const defaultPermissions = {
    view: false,
    create: false,
    update: false,
    delete: false,
};

/**
 * @param {object} row
 * @param {string} key
 *
 * @returns {Permissions}
 */
function formatPermissions(row, key) {
    return Object.assign(
        {},
        defaultPermissions,
        _.pick(
            _.fromPairs(_.map(_.get(row, key, {}), (v) => [v, true])),
            _.keys(defaultPermissions)
        )
    );
}

/**
 * @param {Permissions} permissions
 * @param {object} data
 * @param {string} key
 * @param {string[]} restrictedColumns
 *
 * @returns {Permissions}
 */
function updatePermissionWithRestrictedColumns(
    permissions,
    data,
    key,
    restrictedColumns
) {
    const interestingColumns = _.filter(
        restrictedColumns,
        (c) => data[c] != null
    );
    const props = _.map(interestingColumns, (c) => key + '__' + c);

    return _.mapValues(permissions, (permission, name) => {
        if (permission === false) {
            return permission;
        }

        switch (name) {
            case 'view':
                return _.every(props, (p) => {
                    return new Set(data[p]).has('view');
                });
            case 'update':
            case 'delete':
                return _.every(props, (p) => {
                    return new Set(data[p]).has('update');
                });
        }

        return permission;
    });
}

/**
 * @param {object} row
 * @param {string[]} restrictedColumns
 *
 * @returns {Row}
 */
function formatRow(row, restrictedColumns) {
    return {
        key: row.key,
        data: _.omit(row, [
            'key',
            'guest_user_p',
            'active_user_p',
            ..._.flatMap(restrictedColumns, (name) => [
                'guest_user_p__' + name,
                'active_user_p__' + name,
            ]),
        ]),
        permissions: {
            guest: updatePermissionWithRestrictedColumns(
                formatPermissions(row, 'guest_user_p'),
                row,
                'guest_user_p',
                restrictedColumns
            ),
            activeUser: updatePermissionWithRestrictedColumns(
                formatPermissions(row, 'active_user_p'),
                row,
                'active_user_p',
                restrictedColumns
            ),
        },
    };
}

/**
 * @param {{plan: import('./compiler').Plan, group: string}}
 * @param {Object<string, object>} recordsByType
 * @param {{limit: number, offset: number}} page
 *
 * @returns {{data: Object<string, Row[]>, success: true, total: Object<string, number>, limit?: number, offset?: number}}
 */
function formatList({plan, group}, recordsByType, page) {
    const data = {
        data: _.mapValues(recordsByType, (r, type) => {
            const restrictedColumns = _.keys(
                util.restrictedColumns(plan, group, type)
            );

            return r.rows.map((row) => formatRow(row, restrictedColumns));
        }),
        success: true,
        total: _.reduce(
            recordsByType,
            (res, next) => Math.max(res, next.count),
            0
        ),
    };

    if (page != null) {
        data.limit = page.limit;
        data.offset = page.offset;
    }

    return data;
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 * @param {string} type
 * @param {object} params
 *
 * @returns {object}
 */
function filterListParamsByType(plan, group, type, params) {
    const typeSchema = plan[group][type];
    const columnNames = _.concat(
        _.keys(_.get(typeSchema, 'columns', {})),
        _.flatMap(_.get(typeSchema, ['type', 'types'], {}), (type) =>
            _.keys(_.get(type, 'columns', {}))
        )
    );

    const columnNamesSet = new Set(columnNames);

    return _.mapValues(params, function (v, name) {
        switch (name) {
            case 'filter':
                return _.pick(v, columnNames);
            case 'sort':
                return _.filter(v, (s) => columnNamesSet.has(s[0]));
        }

        return v;
    });
}

/**
 *
 * @param {{plan: import('./compiler').Plan, group: string, user: {realKey: string}}}
 * @param {object} data
 *
 * @return {object}
 */
async function fetchOldData({plan, group, user}, data) {
    return formatList(
        {plan, group},
        _.zipObject(
            _.keys(data),
            await Promise.all(
                _.map(data, function (records, type) {
                    return q.list(
                        {plan, group, type, user: user},
                        {
                            filter: {
                                key: {
                                    in: records.map((u) => u.key),
                                },
                            },
                        }
                    );
                })
            )
        )
    ).data;
}

const RESULT_FORBIDDEN = 'forbidden';
const RESULT_CREATED = 'created';
const RESULT_UPDATED = 'updated';
const RESULT_NOT_FOUND = 'not_found';

async function createData({plan, group}, request) {
    const data = request.parameters.body.data;

    const requiredResourcePermissions = Object.keys(data).map((k) => ({
        resourceGroup: group,
        resourceType: k,
        permission: 'create',
    }));

    const requiredColumnPermissions = util.requiredColumnPermissions(
        plan,
        group,
        data,
        'create'
    );

    const requiredPermissions = _.concat(
        requiredResourcePermissions,
        requiredColumnPermissions
    );

    if (
        !(await permission.userHasAllPermissions(
            request.user,
            requiredPermissions
        ))
    ) {
        return {type: RESULT_FORBIDDEN};
    }

    const records = await db.transactional(async function (client) {
        await client.setUser(request.user.realKey);

        return await Promise.all(
            _.map(data, async function (records, type) {
                const createdKeys = await q.create(
                    {plan, group, type, client},
                    records
                );
                const createdRecords = await q.list(
                    {plan, group, type, client, user: request.user},
                    {
                        filter: {key: {in: createdKeys}},
                    }
                );

                return createdRecords;
            })
        );
    });
    const recordsByType = _.zipObject(_.keys(data), records);

    return {
        type: RESULT_CREATED,
        data: formatList({plan, group}, recordsByType),
    };
}

async function updateData({plan, group}, request) {
    const data = request.parameters.body.data;

    const requiredResourcePermissions = Object.keys(data).map((k) => ({
        resourceGroup: group,
        resourceType: k,
        permission: 'update',
        resourceKey: data[k].map((m) => m.key),
    }));

    const oldData = await fetchOldData({plan, group, user: request.user}, data);
    const requiredOldColumnPermissions = util.requiredColumnPermissions(
        plan,
        group,
        oldData,
        'update'
    );

    const requiredColumnPermissions = util.requiredColumnPermissions(
        plan,
        group,
        data,
        'update'
    );

    const requiredPermissions = _.concat(
        requiredResourcePermissions,
        requiredOldColumnPermissions,
        requiredColumnPermissions
    );

    if (
        !(await permission.userHasAllPermissions(
            request.user,
            requiredPermissions
        ))
    ) {
        return {type: RESULT_FORBIDDEN};
    }

    const records = await db.transactional(async function (client) {
        await client.setUser(request.user.realKey);

        return await Promise.all(
            _.map(data, async function (records, type) {
                await q.update({plan, group, type, client}, records);

                const updatedRecords = await q.list(
                    {plan, group, type, client, user: request.user},
                    {
                        filter: {
                            key: {in: records.map((u) => u.key)},
                        },
                    }
                );

                return updatedRecords;
            })
        );
    });
    const recordsByType = _.zipObject(_.keys(data), records);

    return {
        type: RESULT_UPDATED,
        data: formatList({plan, group}, recordsByType),
    };
}

function sendResponseFromResult(result, response) {
    switch (result.type) {
        case RESULT_CREATED:
            return response.status(201).json(result.data);
        case RESULT_UPDATED:
            return response.status(200).json(result.data);
        case RESULT_FORBIDDEN:
            return response.status(403).json({success: false});
    }

    response.status(500).json({});
    throw new Error(`unknown status: ${result.type}`);
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {import('../routing').RouteData[]}
 */
function createGroup(plan, group) {
    return [
        {
            path: `/rest/${group}/filtered/:types`,
            method: 'post',
            swagger: {
                tags: [group],
            },
            parameters: {
                path: schema.listPath(plan, group),
                body: schema.listBody(plan, group),
            },
            responses: {200: {}},
            middlewares: [
                parameters,
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
            ],
            handler: async function (request, response) {
                const types = request.parameters.path.types;
                const parameters = request.parameters.body;
                const page = {
                    limit: parameters.limit,
                    offset: parameters.offset,
                };

                const recordsP = Promise.all(
                    _.map(types, async function (type) {
                        return await q.list(
                            {plan, group, type, user: request.user},
                            filterListParamsByType(plan, group, type, {
                                sort: parameters.order,
                                filter: parameters.filter,
                                page: page,
                            })
                        );
                    })
                );
                const changesP = Promise.all(
                    _.map(types, async function (type) {
                        return await q.lastChange({group, type});
                    })
                );

                const records = await recordsP;
                const changes = await changesP;

                const recordsByType = _.zipObject(types, records);
                const changeByType = _.zipObject(types, changes);

                response
                    .status(200)
                    .json(
                        Object.assign(
                            {},
                            {changes: changeByType},
                            formatList({plan, group}, recordsByType, page)
                        )
                    );
            },
        },
        {
            path: `/rest/${group}`,
            method: 'post',
            swagger: {
                tags: [group],
            },
            parameters: {
                body: schema.createBody(plan, group),
            },
            responses: {201: {}},
            middlewares: [
                parameters,
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
            ],
            handler: async function (request, response) {
                sendResponseFromResult(
                    await createData({plan, group}, request),
                    response
                );
            },
        },
        {
            path: `/rest/${group}`,
            method: 'put',
            swagger: {
                tags: [group],
            },
            parameters: {
                body: schema.updateBody(plan, group),
            },
            responses: {200: {}},
            middlewares: [
                parameters,
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
                createDependentTypeMiddleware({plan, group}),
            ],
            handler: async function (request, response) {
                sendResponseFromResult(
                    await updateData({plan, group}, request),
                    response
                );
            },
        },
        {
            path: `/rest/${group}`,
            method: 'delete',
            swagger: {
                tags: [group],
            },
            parameters: {body: schema.deleteBody(plan, group)},
            responses: {200: {}},
            middlewares: [
                parameters,
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
            ],
            handler: async function (request, response) {
                const data = request.parameters.body.data;

                const requiredResourcePermissions = Object.keys(data).map(
                    (k) => ({
                        resourceGroup: group,
                        resourceType: k,
                        permission: 'delete',
                        resourceKey: data[k].map((m) => m.key),
                    })
                );

                const oldData = await fetchOldData(
                    {plan, group, user: request.user},
                    data
                );
                const requiredOldColumnPermissions = util.requiredColumnPermissions(
                    plan,
                    group,
                    oldData,
                    'update'
                );

                const requiredPermissions = _.concat(
                    requiredResourcePermissions,
                    requiredOldColumnPermissions
                );

                if (
                    !(await permission.userHasAllPermissions(
                        request.user,
                        requiredPermissions
                    ))
                ) {
                    return response.status(403).json({success: false});
                }

                await db.transactional(async function (client) {
                    await client.setUser(request.user.realKey);
                    await Promise.all(
                        _.map(data, async function (records, type) {
                            await q.deleteRecords(
                                {plan, group, type, client},
                                records
                            );
                        })
                    );
                });

                response.status(200).json({});
            },
        },
    ];
}

/**
 * @param {import('./compiler').Plan} plan
 *
 * @returns {import('../routing').RouteData[]}
 */
function createAll(plan) {
    const handlers = [];

    _.forEach(plan, function (g, group) {
        handlers.push(...createGroup(plan, group));
    });

    return handlers;
}

module.exports = {
    createAll,
};
