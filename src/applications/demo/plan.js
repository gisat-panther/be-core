const Joi = require('joi');
const uuid = require('../../uuid');

module.exports = {
    demo: {
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
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                email: {
                    defaultValue: null,
                    schema: Joi.string(),
                },
            },
        },
    },
};
