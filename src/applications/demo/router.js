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
];
