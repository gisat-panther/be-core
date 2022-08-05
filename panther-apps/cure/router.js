const userMiddleware = require('../../src/middlewares/user');
const authMiddleware = require('../../src/middlewares/auth');
const autoLoginMiddleware = require('../../src/middlewares/auto-login');

const handler = require('./handler.js');

module.exports = [
    {
        path: '/rest/project/cure/orders',
        method: 'get',
        swagger: {
            tags: ['project', 'cure', 'orders']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {} },
        handler: async (request, response) => {
            const orders = await handler.getOrders(request.user);
            if (orders) {
                response.send(orders);
            } else {
                response.status(500).end();
            }
        }
    },
    {
        path: '/rest/project/cure/service',
        method: 'post',
        swagger: {
            tags: ['project', 'cure', 'service']
        },
        middlewares: [
            userMiddleware,
            autoLoginMiddleware,
            authMiddleware,
        ],
        responses: { 200: {}, 500: {} },
        handler: async (request, response) => {
            const order = await handler.executeOrder(request.user, request.body);
            if (order) {
                response.send(order);
            } else {
                response.status(500).end();
            }
        }
    },
    {
        path: '/rest/project/cure/register',
        method: 'post',
        swagger: {
            tags: ['project', 'cure', 'register']
        },
        responses: { 200: {}, 400: {} },
        handler: async (request, response) => {
            const status = await handler.registerUser(request.body);
            if (status) {
                response.status(201).json({});
            } else {
                response.status(400).end();
            }
        }
    }
];
