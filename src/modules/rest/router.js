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
 * @param {object} row
 *
 * @returns {Row}
 */
function formatRow(row) {
    return {
        key: row.key,
        data: _.omit(row, ['key', 'guest_user_p', 'active_user_p']),
        permissions: {
            guest: formatPermissions(row, 'guest_user_p'),
            activeUser: formatPermissions(row, 'active_user_p'),
        },
    };
}

/**
 * @param {Object<string, object>} recordsByType
 * @param {{limit: number, offset: number}} page
 *
 * @returns {{data: Object<string, Row[]>, success: true, total: Object<string, number>, limit?: number, offset?: number}}
 */
function formatList(recordsByType, page) {
    const data = {
        data: _.mapValues(recordsByType, (r) => r.rows.map(formatRow)),
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
                            formatList(recordsByType, page)
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
                const data = request.parameters.body.data;

                const requiredResourcePermissions = Object.keys(data).map(
                    (k) => ({
                        resourceGroup: group,
                        resourceType: k,
                        permission: 'create',
                    })
                );

                const requiredColumnPermissions = util.requiredColumnPermissions(
                    plan,
                    group,
                    data
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
                    return response.status(403).json({success: false});
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

                response.status(201).json(formatList(recordsByType));
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
                const data = request.parameters.body.data;

                const requiredPermissions = Object.keys(data).map((k) => ({
                    resourceGroup: group,
                    resourceType: k,
                    permission: 'update',
                    resourceKey: data[k].map((m) => m.key),
                }));
                if (
                    !(await permission.userHasAllPermissions(
                        request.user,
                        requiredPermissions
                    ))
                ) {
                    return response.status(403).json({success: false});
                }

                const records = await db.transactional(async function (client) {
                    await client.setUser(request.user.realKey);

                    return await Promise.all(
                        _.map(data, async function (records, type) {
                            await q.update(
                                {plan, group, type, client},
                                records
                            );

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

                response.status(200).json(formatList(recordsByType));
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

                const requiredPermissions = Object.keys(data).map((k) => ({
                    resourceGroup: group,
                    resourceType: k,
                    permission: 'delete',
                    resourceKey: data[k].map((m) => m.key),
                }));
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
