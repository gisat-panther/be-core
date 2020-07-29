const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const parametersMiddleware = require('../../middlewares/parameters');
const uuid = require('../../uuid');
const _ = require('lodash');
const q = require('./query');
const Joi = require('../../joi');
const auth = require('./auth');

const UserType = {
    USER: 'user',
    GUEST: 'guest',
};

/**
 * @param {{resourceGroup: string, resourceType: string, permission: string}[]} permissions
 * @param {object} plan
 *
 * @returns {Object<string, Object<string, Object<string, true>>>}
 */
function formatPermissions(permissions, plan) {
    const permissionsByResourceGroup = _.groupBy(
        permissions,
        (p) => p.resourceGroup
    );

    const formattedPermissions = {};
    _.each(plan, (dataType, group) => {
        formattedPermissions[group] = {};
        const permissionsByResourceType = _.groupBy(
            permissionsByResourceGroup[group],
            (p) => p.resourceType
        );
        _.each(_.keys(dataType), (resourceType) => {
            if (permissionsByResourceType[resourceType] == null) {
                return;
            }

            const permissions = Object.fromEntries(
                _.map(permissionsByResourceType[resourceType], (v) => [
                    v.permission,
                    true,
                ])
            );
            formattedPermissions[group][resourceType] = permissions;
        });
    });

    return formattedPermissions;
}

async function getLoginInfo(user, token, plan) {
    const [userInfo, permissions] = await Promise.all([
        q.getUserInfoByKey(user.realKey),
        q.userPermissionsByKey(user.realKey),
    ]);

    return {
        key: user.key,
        data: {
            name: _.get(userInfo, 'name', null),
            email: _.get(userInfo, 'email', null),
            phone: _.get(userInfo, 'phone', null),
        },
        permissions: formatPermissions(permissions, plan),
        authToken: token,
    };
}

const LoginBodySchema = Joi.object().meta({className: 'Login'}).keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
});

module.exports = (plan) => [
    {
        path: '/rest/logged',
        method: 'get',
        swagger: {
            tags: ['login'],
        },
        responses: {200: {}},
        middlewares: [userMiddleware],
        handler: function (request, response) {
            if (request.user) {
                response.status(200).json({key: request.user.key});
            } else {
                response.status(404).json({status: 'Nobody is logged in.'});
            }
        },
    },
    {
        path: '/api/login/login',
        method: 'post',
        swagger: {
            tags: ['login'],
        },
        parameters: {
            body: LoginBodySchema,
        },
        responses: {200: {}},
        middlewares: [parametersMiddleware],
        handler: async function (request, response, next) {
            const {username, password} = request.parameters.body;

            try {
                const user = await q.getUser(username, password);
                if (user == null) {
                    response.status(401).json().end();
                    return;
                }

                const token = await auth.createAuthToken(
                    auth.tokenPayload({
                        ...user,
                        ...{type: UserType.USER, realKey: user.key},
                    })
                );

                return response
                    .status(200)
                    .json(
                        await getLoginInfo(
                            Object.assign({}, user, {realKey: user.key}),
                            token,
                            plan
                        )
                    );
            } catch (err) {
                next(err);
            }
        },
    },
    {
        path: '/api/login/logout',
        method: 'post',
        swagger: {
            tags: ['login'],
        },
        responses: {200: {}},
        handler: function (request, response) {
            response.status(200).end();
        },
    },
    {
        path: '/api/login/getLoginInfo',
        method: 'get',
        swagger: {
            tags: ['login'],
        },
        responses: {200: {}},
        middlewares: [userMiddleware, autoLoginMiddleware, authMiddleware],
        handler: async function (request, response) {
            response
                .status(200)
                .json(
                    await getLoginInfo(request.user, request.authToken, plan)
                );
        },
    },
];
