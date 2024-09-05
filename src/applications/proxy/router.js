const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const autoLoginKongHqMiddleware = require('../../middlewares/auto-login-konghq');
const handler = require('./handler.js');

module.exports = [
    {
        path: '/proxy/wms/:spatialDataSourceKey',
        method: 'get',
        swagger: {
            tags: ['wms']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.get.wms,
    },
    {
        path: '/proxy/wmts/:spatialDataSourceKey/:z/:x/:y.:ext',
        method: 'get',
        swagger: {
            tags: ['wmts']
        },
        middlewares: [
            userMiddleware,
            autoLoginKongHqMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.get.wmts,
    }
];
