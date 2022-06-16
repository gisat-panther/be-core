const userMiddleware = require('../../src/middlewares/user');
const authMiddleware = require('../../src/middlewares/auth');
const autoLoginMiddleware = require('../../src/middlewares/auto-login');

const { s3: importFromS3 } = require('./import/index');

module.exports = [
    {
        path: '/rest/project/worldWater/import/raster',
        method: 'post',
        swagger: {
            tags: ['project', 'worldWater', 'import', 'raster']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: async (request, response) => {
            try {
                response.send(await importFromS3(request.body));
            } catch (error) {
                response.status(500).send(JSON.stringify(error));
            }
        }
    }
];
