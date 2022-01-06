const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const hashMiddleware = require('../../middlewares/hash');
const _ = require('lodash/fp');
const commandResult = require('./result');

const forEachWithKey = _.forEach.convert({ cap: false });

/**
 * @param {{type: string, data: any}} result
 *
 * @returns {{status: number, body: any}}
 */
function resultToResponse(result) {
    switch (result.type) {
        case commandResult.SUCCESS:
            return { status: 200, body: result.data };
        case commandResult.CREATED:
            return { status: 201, body: result.data };
        case commandResult.UPDATED:
            return { status: 200, body: result.data };
        case commandResult.DELETED:
            return { status: 200, body: {} };
        case commandResult.BAD_REQUEST:
            return { status: 400, body: result.data };
        case commandResult.FORBIDDEN:
            return { status: 403, body: { success: false } };
    }

    throw new Error(`unknown status: ${result.type}`);
}

function sendResponse(responseData, response) {
    return response.status(responseData.status).json(responseData.body);
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 * @param {Object<string, import('./command').Command>} commands
 *
 * @returns {import('../routing').RouteData[]}
 */
function createGroup(plan, group, commands) {
    return [
        {
            path: `/rest/${group}/filtered/:types`,
            method: 'post',
            swagger: {
                tags: [group],
            },
            parameters: commands.list.parameters,
            responses: { 200: {} },
            middlewares: [
                userMiddleware,
                autoLoginMiddleware,
                authMiddleware,
                hashMiddleware,
            ],
            handler: async function (request, response) {
                const responseData = resultToResponse(
                    await commands.list.handler(request)
                );

                sendResponse(responseData, response);
            },
        },
        {
            path: `/rest/${group}`,
            method: 'post',
            swagger: {
                tags: [group],
            },
            parameters: commands.create.parameters,
            responses: { 201: {} },
            middlewares: [userMiddleware, autoLoginMiddleware, authMiddleware],
            handler: async function (request, response) {
                const responseData = resultToResponse(
                    await commands.create.handler(request)
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
            parameters: commands.update.parameters,
            responses: { 200: {} },
            middlewares: [userMiddleware, autoLoginMiddleware, authMiddleware],
            handler: async function (request, response) {
                const responseData = resultToResponse(
                    await commands.update.handler(request)
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
            parameters: commands.delete.parameters,
            responses: { 200: {} },
            middlewares: [userMiddleware, autoLoginMiddleware, authMiddleware],
            handler: async function (request, response) {
                const responseData = resultToResponse(
                    await commands.delete.handler(request)
                );

                sendResponse(responseData, response);
            },
        },
    ];
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {Object<string, Object<string, import('./command').Command>>}
 *
 * @returns {import('../routing').RouteData[]}
 */
function createAll(plan, commands) {
    const handlers = [];

    forEachWithKey(function (g, group) {
        handlers.push(...createGroup(plan, group, commands[group]));
    }, plan);

    return handlers;
}

module.exports = {
    createAll,
};
