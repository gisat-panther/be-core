const parameters = require('../../middlewares/parameters');
const userMiddleware = require('../../middlewares/user');
const permission = require('../../permission');
const _ = require('lodash');
const schema = require('./schema');
const q = require('./query');
const db = require('../../db');

function formatRow(row) {
    return {
        key: row.key,
        data: _.omit(row, ['key']),
    };
}

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

function filterListParamsByType(plan, group, type, params) {
    const columnNames = Object.keys(plan[group][type].columns);
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
            middlewares: [parameters],
            handler: async function (request, response) {
                const types = request.parameters.path.types;
                const parameters = request.parameters.body;
                const page = {
                    limit: parameters.limit,
                    offset: parameters.offset,
                };

                const records = await Promise.all(
                    _.map(types, async function (type) {
                        return await q.list(
                            {plan, group, type},
                            filterListParamsByType(plan, group, type, {
                                sort: parameters.order,
                                filter: parameters.filter,
                                page: page,
                            })
                        );
                    })
                );

                const recordsByType = _.zipObject(types, records);

                response.status(200).json(formatList(recordsByType, page));
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
            middlewares: [parameters, userMiddleware],
            handler: async function (request, response) {
                const data = request.parameters.body.data;

                const requiredPermissions = Object.keys(data).map((k) => ({
                    resourceType: k,
                    permission: 'create',
                }));
                console.log('required permissions', requiredPermissions);
                if (
                    !(await permission.userHasAllPermissions(
                        request.user,
                        requiredPermissions
                    ))
                ) {
                    return response.status(403).json({success: false});
                }

                const records = await db.transactional(async function (client) {
                    return await Promise.all(
                        _.map(data, async function (records, type) {
                            const createdKeys = await q.create(
                                {plan, group, type, client},
                                records
                            );
                            const createdRecords = await q.list(
                                {plan, group, type, client},
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
            middlewares: [parameters],
            handler: async function (request, response) {
                const data = request.parameters.body.data;
                const records = await db.transactional(async function (client) {
                    return await Promise.all(
                        _.map(data, async function (records, type) {
                            await q.update(
                                {plan, group, type, client},
                                records
                            );

                            const updatedRecords = await q.list(
                                {plan, group, type, client},
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
            middlewares: [parameters],
            handler: async function (request, response) {
                await db.transactional(async function (client) {
                    await Promise.all(
                        _.map(request.parameters.body.data, async function (
                            records,
                            type
                        ) {
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
