const Joi = require('joi');
const uuid = require('../../src/uuid');
const qb = require('@imatic/pgqb');
const {SQL} = require('sql-template-strings');

const Geometry = Joi.object().meta({type: 'geometry'});

module.exports = {
    specific: {
        worldCerealProductMetadata: {
            context: {
                list: {
                    columns: [
                        'key',
                        'tileKeys',
                        'geometry',
                        'data',
                        'global'
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'tileKeys',
                        'geometry',
                        'data',
                        'global'
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'tileKeys',
                        'geometry',
                        'data',
                        'global'
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
                geometry: {
                    defaultValue: null,
                    schema: Geometry.allow(null),
                    selectExpr: function ({alias}) {
                        return qb.val.raw(`ST_AsGeoJSON(${alias}."geometry")::JSON AS "geometry"`);
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
                },
                global: {
                    defaultValue: false,
                    schema: Joi.boolean()
                }
            },
            relations: {
            }
        }
    },
};
