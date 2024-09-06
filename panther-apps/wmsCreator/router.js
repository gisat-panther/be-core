const userMiddleware = require('../../src/middlewares/user');
const authMiddleware = require('../../src/middlewares/auth');
const autoLoginMiddleware = require('../../src/middlewares/auto-login');

const { s3: createFromS3, local: createFromLocal } = require('./import/index');

module.exports = [
    {
        path: '/rest/wmsCreator/s3',
        method: 'post',
        swagger: {
            tags: ['s3', 'wms', 'create']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: async (request, response) => {
            try {
                response.send(await createFromS3(request.body));
            } catch (error) {
                console.log(error);
                response.status(500).send({message: error.message});
            }
        }
    },
    {
        path: '/rest/wmsCreator/local',
        method: 'post',
        swagger: {
            tags: ['local', 'wms', 'create']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: async (request, response) => {
            try {
                response.send(await createFromLocal(request.body));
            } catch (error) {
                console.log(error);
                response.status(500).send({message: error.message});
            }
        }
    }
];
