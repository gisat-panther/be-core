const Joi = require('joi');

module.exports = {
    plan: {
        app1: {
            user: {
                table: 'users',
                context: {
                    list: {
                        columns: ['key', 'email'],
                    },
                    create: {
                        columns: ['key', 'email'],
                    },
                    update: {
                        columns: ['key', 'email'],
                    },
                },
                columns: {
                    key: {
                        defaultValue: null,
                        schema: Joi.string().uuid(),
                    },
                    email: {
                        defaultValue: null,
                        schema: Joi.string(),
                    },
                },
            },
        },
    },
    router: [
        {
            path: '/app1/greet',
            method: 'get',
            swagger: {
                tags: ['app1'],
                summary: 'Sends some greetings',
                description: 'Description here',
            },
            responses: {200: {description: 'Response description'}},
            handler: function (request, response) {
                response.status(200).send('hello there!!!');
            },
        },
    ],
    generatedPermissions: () => ({
        app1__target_group: {
            /*
             * Users in `sourceGroups` have `view` permission on users from `targetGroups`.
             */
            sourceGroups: ['app1_sourceGroup'],
            targetGroups: ['app1_targetGroup'],
            targetPermissions: ['view'],
        },
    }),
};
