const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');

module.exports = [
    {
        path: '/rest/timeSerie/filtered',
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
        handler: (request, response) => {
            response.code(501).end()
        },
    }
];
