const Joi = require('joi');
const uuid = require('../../src/uuid');
const qb = require('@imatic/pgqb');
const {SQL} = require('sql-template-strings');

module.exports = {
    specific: {
        worldCerealProductMetadata: {
            context: {
                list: {
                    columns: [
                        'key',
                        'tileKeys',
                        'bbox',
                        'data'
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'tileKeys',
                        'bbox',
                        'data'
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'tileKeys',
                        'bbox',
                        'data'
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid()
                },
                tileKeys: {
                    defaultValue: null,
                    schema: Joi.array().items(Joi.string()).allow(null)
                },
                bbox: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                    selectExpr: function ({alias}) {
                        return qb.val.raw(`ST_AsGeoJSON(${alias}."bbox")::JSON AS "bbox"`);
                    },
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(SQL`ST_GeomFromGeoJSON(${value})`);
                    },
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
