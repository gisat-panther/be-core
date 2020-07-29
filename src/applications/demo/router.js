const getPlan = require('../plan').get;

module.exports = [
    {
        path: '/demo/greet',
        method: 'get',
        swagger: {
            tags: ['demo'],
            summary: 'Sends some greetings',
            description: 'Description here',
        },
        responses: {200: {description: 'Response description'}},
        handler: function (request, response) {
            response.status(200).send('hello there!!!');
        },
    },
    {
        path: '/demo/show-groups',
        method: 'get',
        swagger: {
            tags: ['demo'],
            summary: 'Shows configured groups of the plan',
        },
        responses: {200: {}},
        handler: function (request, response) {
            response.status(200).json(Object.keys(getPlan()));
        },
    },
];
