const parameters = require('../../middlewares/parameters');
const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const createDependentTypeMiddleware = require('./middlewares/dependentType');
const hashMiddleware = require('../../middlewares/hash');
const permission = require('../../permission');
const _ = require('lodash/fp');
const schema = require('./schema');
const q = require('./query');
const db = require('../../db');
const util = require('./util');
const translation = require('./translation');
const customFields = require('./custom-fields');

const mapWithKey = _.map.convert({cap: false});
const mapValuesWithKey = _.mapValues.convert({cap: false});
const forEachWithKey = _.forEach.convert({cap: false});

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
            _.keys(defaultPermissions),
            _.fromPairs(_.map((v) => [v, true], _.getOr({}, key, row)))
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
        (c) => data[c] != null,
        restrictedColumns
    );
    const props = _.map((c) => key + '__' + c, interestingColumns);

    return mapValuesWithKey((permission, name) => {
        if (permission === false) {
            return permission;
        }

        switch (name) {
            case 'view':
                return _.every((p) => {
                    return new Set(data[p]).has('view');
                }, props);
            case 'update':
            case 'delete':
                return _.every((p) => {
                    return new Set(data[p]).has('update');
                }, props);
        }

        return permission;
    }, permissions);
}

/**
 * @param {object} row
 * @param {string[]} restrictedColumns
 *
 * @returns {Row}
 */
function formatRow(row, restrictedColumns) {
    return _.flow(
        translation.formatRow,
        customFields.formatRow
    )({
        key: row.key,
        data: _.omit(
            [
                'key',
                'guest_user_p',
                'active_user_p',
                ..._.flatMap(
                    (name) => [
                        'guest_user_p__' + name,
                        'active_user_p__' + name,
                    ],
                    restrictedColumns
                ),
            ],
            row
        ),
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
    });
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
        data: mapValuesWithKey((r, type) => {
            const restrictedColumns = _.keys(
                util.restrictedColumns(plan, group, type)
            );

            return r.rows.map((row) => formatRow(row, restrictedColumns));
        }, recordsByType),
        success: true,
        total: _.reduce(
            (res, next) => Math.max(res, next.count),
            0,
            recordsByType
        ),
    };

    if (page != null) {
        data.limit = page.limit;
        data.offset = page.offset;
    }

    return data;
}

function mergeListsWithoutPage(l1, l2) {
    const l1Keys = Object.keys(l1.data);
    const l2Keys = Object.keys(l2.data);
    const conflictingKeys = _.intersection(l1Keys, l2Keys);

    const newData = _.reduce(
        (acc, k) => {
            acc[k] = _.concat(l1.data[k], l2.data[k]);

            return acc;
        },
        Object.assign({}, l1.data, l2.data),
        conflictingKeys
    );

    const data = {
        data: newData,
        success: l1.success && l2.success,
        total: Object.values(newData).reduce(
            (acc, records) => Math.max(acc, records.length),
            0
        ),
    };

    return data;
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
                mapWithKey(function (records, type) {
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
                }, data)
            )
        )
    ).data;
}

const RESULT_FORBIDDEN = 'forbidden';
const RESULT_CREATED = 'created';
const RESULT_UPDATED = 'updated';

async function createData({plan, group, client}, request) {
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

    const records = await Promise.all(
        mapWithKey(async function (records, type) {
            const [createdKeys] = await Promise.all([
                q.create({plan, group, type, client}, records),
                translation.updateTranslations({client, group, type}, records),
            ]);

            const createdRecords = await q.list(
                {plan, group, type, client, user: request.user},
                {
                    filter: {key: {in: createdKeys}},
                }
            );

            return createdRecords;
        }, data)
    );
    const recordsByType = _.zipObject(_.keys(data), records);

    return {
        type: RESULT_CREATED,
        data: formatList({plan, group}, recordsByType),
    };
}

async function updateData({plan, group, client}, request) {
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

    const requiredPermissions = [
        ...requiredResourcePermissions,
        ...requiredOldColumnPermissions,
        ...requiredColumnPermissions,
    ];

    if (
        !(await permission.userHasAllPermissions(
            request.user,
            requiredPermissions
        ))
    ) {
        return {type: RESULT_FORBIDDEN};
    }

    const records = await Promise.all(
        mapWithKey(async function (records, type) {
            await Promise.all([
                q.update({plan, group, type, client}, records),
                translation.updateTranslations({client, group, type}, records),
            ]);

            const updatedRecords = await q.list(
                {plan, group, type, client, user: request.user},
                {
                    filter: {
                        key: {in: records.map((u) => u.key)},
                    },
                }
            );

            return updatedRecords;
        }, data)
    );

    const recordsByType = _.zipObject(_.keys(data), records);

    return {
        type: RESULT_UPDATED,
        data: formatList({plan, group}, recordsByType),
        oldData: oldData,
    };
}

function resultToResponse(result) {
    switch (result.type) {
        case RESULT_CREATED:
            return {status: 201, body: result.data};
        case RESULT_UPDATED:
            return {status: 200, body: result.data};
        case RESULT_FORBIDDEN:
            return {status: 403, body: {success: false}};
    }

    throw new Error(`unknown status: ${result.type}`);
}

function sendResponse(responseData, response) {
    return response.status(responseData.status).json(responseData.body);
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
                customFields.selectCustomFieldMiddleware({group}),
                parameters,
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
                hashMiddleware,
            ],
            handler: async function (request, response) {
                const types = request.parameters.path.types;
                const parameters = request.parameters.body;
                const page = {
                    limit: parameters.limit,
                    offset: parameters.offset,
                };

                const records = await Promise.all(
                    _.map(async function (type) {
                        return await q.list(
                            {
                                plan,
                                group,
                                type,
                                user: request.user,
                                customFields: request.customFields,
                            },
                            {
                                sort: parameters.order,
                                filter: parameters.filter,
                                page: page,
                                translations: parameters.translations,
                            }
                        );
                    }, types)
                );
                const recordsByType = _.zipObject(types, records);

                const changes = await Promise.all(
                    mapWithKey(async function (res, type) {
                        return await q.lastChange(
                            {plan, group, type},
                            _.map((record) => record.key, res.rows)
                        );
                    }, recordsByType)
                );
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
                customFields.modifyCustomFieldMiddleware({plan, group}),
                translation.modifyTranslationMiddleware({plan, group}),
            ],
            handler: async function (request, response) {
                const responseData = resultToResponse(
                    await db.transactional(async (client) => {
                        await client.setUser(request.user.realKey);
                        await customFields.storeNew(
                            {client, group},
                            request.customFields
                        );

                        return await createData({plan, group, client}, request);
                    })
                );

                sendResponse(responseData, response);
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
                customFields.modifyCustomFieldMiddleware({plan, group}),
                translation.modifyTranslationMiddleware({plan, group}),
            ],
            handler: async function (request, response) {
                const responseData = await db.transactional(async (client) => {
                    await client.setUser(request.user.realKey);
                    await customFields.storeNew(
                        {client, group},
                        request.customFields
                    );

                    const updatedResult = await updateData(
                        {plan, group, client},
                        request
                    );
                    if (updatedResult.type !== RESULT_UPDATED) {
                        return resultToResponse(updatedResult);
                    }

                    const newData = _.pickBy(
                        (records) => !_.isEmpty(records),
                        mapValuesWithKey((records, type) => {
                            const updatedKeys = _.map(
                                (record) => record.key,
                                updatedResult.data.data[type]
                            );
                            const requestedKeys = _.map(
                                (record) => record.key,
                                request.parameters.body.data[type]
                            );
                            const missingKeys = new Set(
                                _.difference(requestedKeys, updatedKeys)
                            );

                            return _.filter(
                                (record) => missingKeys.has(record.key),
                                request.body.data[type]
                            );
                        }, request.parameters.body.data)
                    );

                    if (_.isEmpty(newData)) {
                        return resultToResponse(updatedResult);
                    }

                    request.body = {data: newData};
                    request.match = _.set(
                        ['data', 'parameters'],
                        {
                            body: schema.createBody(plan, group),
                        },
                        request.match
                    );

                    await new Promise((resolve, reject) => {
                        parameters(request, response, (err) => {
                            if (err) {
                                return reject(err);
                            }

                            resolve();
                        });
                    });

                    const createdResult = await createData(
                        {plan, group, client},
                        request
                    );
                    if (createdResult.type !== RESULT_CREATED) {
                        return resultToResponse(createdResult);
                    }

                    return resultToResponse({
                        type: RESULT_UPDATED,
                        data: mergeListsWithoutPage(
                            updatedResult.data,
                            createdResult.data
                        ),
                    });
                });

                sendResponse(responseData, response);
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
                        mapWithKey(async function (records, type) {
                            await q.deleteRecords(
                                {plan, group, type, client},
                                records
                            );
                        }, data)
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

    forEachWithKey(function (g, group) {
        handlers.push(...createGroup(plan, group));
    }, plan);

    return handlers;
}

module.exports = {
    createAll,
};
