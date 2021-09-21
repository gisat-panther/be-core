const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const autoLoginKongHqMiddleware = require('../../middlewares/auto-login-konghq');

const product = require('./product');
const user = require('./user');

module.exports = [
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
        handler: product.update
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
    }
];
