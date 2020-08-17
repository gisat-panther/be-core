const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');

const request = require('../data/src/handlers/request');

module.exports = [
    {
        path: '/rest/data/filtered',
        method: 'post',
        swagger: {
            tags: ['data']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: {200: {}},
        handler: request,
    },
];
