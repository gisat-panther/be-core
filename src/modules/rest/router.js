const parameters = require('../../middlewares/parameters');
const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const createDependentTypeMiddleware = require('./middlewares/dependentType');
const hashMiddleware = require('../../middlewares/hash');
const _ = require('lodash/fp');
const schema = require('./schema');
const translation = require('./translation');
const customFields = require('./custom-fields');
const api = require('./api');

const forEachWithKey = _.forEach.convert({cap: false});

/**
 * @param {{type: string, data: any}} result
 *
 * @returns {{status: number, body: any}}
 */
function resultToResponse(result) {
    switch (result.type) {
        case api.RESULT_CREATED:
            return {status: 201, body: result.data};
        case api.RESULT_UPDATED:
            return {status: 200, body: result.data};
        case api.RESULT_DELETED:
            return {status: 200, body: {}};
        case api.RESULT_FORBIDDEN:
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
                response
                    .status(200)
                    .json(await api.list({plan, group}, request));
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
                    await api.create({plan, group}, request)
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
                const responseData = resultToResponse(
                    await api.update({plan, group}, request)
                );

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
                const responseData = resultToResponse(
                    await api.deleteRecords({plan, group}, request)
                );

                sendResponse(responseData, response);
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
