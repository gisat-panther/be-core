const multer = require('multer');

const fileParseMiddleware = multer().array("file");

const importTokenLoginMiddleware = require('../../middlewares/import-token-login');
const handler = require('./handler');

module.exports = [
    {
        path: '/rest/fixtures/import',
        method: 'post',
        swagger: {
            tags: ['fixtures', 'import']
        },
        middlewares: [
            fileParseMiddleware,
            importTokenLoginMiddleware
        ],
        responses: { 200: {} },
        handler: handler.restImport
    }
];
