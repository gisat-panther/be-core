const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const autoLoginKongHqMiddleware = require('../../middlewares/auto-login-konghq');
const handler = require('./handler.js');

module.exports = [
    {
        path: '/download/:dataSourceKey/:itemKey',
        method: 'get',
        swagger: {
            tags: ['download']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.download
    }
];
