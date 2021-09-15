const Joi = require('joi');
const uuid = require('../../uuid');

module.exports = {
    specific: {
        worldCerealProductMetadata: {
            context: {
                list: {
                    columns: [
                        'key',
                        'data'
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'data'
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'data'
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid()
                },
                data: {
                    defaultValue: null,
                    schema: Joi.object().allow(null)
                }
            },
            relations: {
            }
        }
    },
};
