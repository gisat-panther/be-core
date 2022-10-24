const yamljs = require('yamljs');

const userMiddleware = require('../../src/middlewares/user');
const authMiddleware = require('../../src/middlewares/auth');
const autoLoginMiddleware = require('../../src/middlewares/auto-login');
const autoLoginKongHqMiddleware = require('../../src/middlewares/auto-login-konghq');

const product = require('./product');
const user = require('./user');
const wcInit = require('./init');

const ADMIN_USER_KEY = "3fdd158d-4b78-4d11-92c7-403b4adab4d8";

module.exports = [
    {
        path: '/rest/project/worldCereal/init',
        method: 'get',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: (request, response) => {
            if (request.headers['x-user-info'] === ADMIN_USER_KEY) {
                response.status(200).send(wcInit.run());
            } else {
                response.status(403).end();
            }
        }
    },
    {
        path: '/rest/project/worldCereal/swagger.json',
        method: 'get',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        responses: { 200: {} },
        handler: (request, response) => response.json(yamljs.load('./panther-apps/worldCereal/swagger.yml'))
    },
    {
        path: '/rest/project/worldCereal/product',
        method: 'post',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: product.create
    },
    {
        path: '/rest/project/worldCereal/product',
        method: 'put',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: product.create
    },
    {
        path: '/rest/project/worldCereal/product',
        method: 'delete',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: product.remove
    },
    {
        path: '/rest/project/worldCereal/product/filtered',
        method: 'post',
        swagger: {
            tags: ['project', 'worldCereal', 'product']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: product.view
    },
    {
        path: '/rest/project/worldCereal/product/global',
        method: 'get',
        swagger: {
            tags: ['project', 'worldCereal', 'product', 'global']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: product.viewGlobal
    },
    {
        path: '/rest/project/worldCereal/user',
        method: 'post',
        swagger: {
            tags: ['project', 'worldCereal', 'user']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: user.create
    },
    {
        path: '/rest/project/worldCereal/user',
        method: 'put',
        swagger: {
            tags: ['project', 'worldCereal', 'user']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: user.update
    },
    {
        path: '/rest/project/worldCereal/user',
        method: 'delete',
        swagger: {
            tags: ['project', 'worldCereal', 'user']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: user.remove
    },
    {
        path: '/rest/project/worldCereal/user/sessionStart',
        method: 'get',
        swagger: {
            tags: ['project', 'worldCereal', 'user']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: user.sessionStart
    }
];
