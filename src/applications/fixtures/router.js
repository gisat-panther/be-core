const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const handler = require('./handler');

module.exports = [
    {
        path: '/rest/fixtures/import',
        method: 'post',
        swagger: {
            tags: ['fixtures', 'import']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.restImport
    }
];
