const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const handler = require('./handler.js');

module.exports = [
    {
        path: '/wms/:spatialDataSourceKey',
        method: 'get',
        swagger: {
            tags: ['wms']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.get.wms,
    },
    {
        path: '/wmts/:spatialDataSourceKey/:z/:x/:y.:ext',
        method: 'get',
        swagger: {
            tags: ['wmts']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: handler.get.wmts,
    }
];
