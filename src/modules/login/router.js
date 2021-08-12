const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const parametersMiddleware = require('../../middlewares/parameters');
const q = require('./query');
const Joi = require('../../joi');
const sso = require('./sso');
const info = require('./info');

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

                return response
                    .status(200)
                    .json(await info.getWithToken(plan, user));
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
            response.status(200).json({});
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
                .json(await info.get(request.user, request.authToken, plan));
        },
    },
    ...sso.createRouter(plan),
];
