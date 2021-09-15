const multer = require('multer');

const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const autoLoginKongHqMiddleware = require('../../middlewares/auto-login-konghq');

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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
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
        handler: (request, response) => {
            response.send({});
        }
    }
];
