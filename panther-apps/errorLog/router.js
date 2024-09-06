const db = require('../../src/db');

const userMiddleware = require('../../src/middlewares/user');
const authMiddleware = require('../../src/middlewares/auth');
const autoLoginMiddleware = require('../../src/middlewares/auto-login');

module.exports = [
    {
        path: '/rest/errorLogs/:key',
        method: 'get',
        swagger: {
            tags: ['error', 'log']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: async (request, response) => {
            const errorKey = request.params.key;
            if (errorKey) {
                const data = await db
                    .query(`SELECT data FROM various."errorLogs" WHERE key = ${errorKey}`)
                    .then((pgResult) => pgResult.rows[0].data);

                if (data) {
                    response.send(data);
                } else {
                    response.status(500).end();
                }
            } else {
                response.status(500).end();
            }
        }
    }
];
