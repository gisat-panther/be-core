const multer = require('multer');

const userMiddleware = require('../../middlewares/user');
const authMiddleware = require('../../middlewares/auth');
const autoLoginMiddleware = require('../../middlewares/auto-login');
const fileParseMiddleware = multer().single("file");

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
        handler: request.data,
    },
    {
        path: '/rest/attributeData/filtered',
        method: 'post',
        swagger: {
            tags: ['attributeData']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: {200: {}},
        handler: request.attributeData,
    },
    {
        path: '/rest/data/import',
        method: 'post',
        swagger: {
            tags: ["data", "import"]
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
            fileParseMiddleware
        ],
        responses: {200: {}},
        handler: request.import
    },
    {
        path: '/rest/data/import/status/:key',
        method: 'get',
        swagger: {
            tags: ["data", "status"]
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware
        ],
        responses: {200: {}},
        handler: request.status.import
    }
];
