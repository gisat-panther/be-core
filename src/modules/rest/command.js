const schema = require('./schema');
const api = require('./api');
const customFields = require('./custom-fields');
const translation = require('./translation');
const apiUtil = require('../../util/api');
const commandResult = require('./result');
const _ = require('lodash/fp');
const q = require('./query');

const mapWithKeys = _.map.convert({cap: false});

/**
 * @typedef Command
 * @property {Object<string, object>} parameters
 * @property {Function} handler
 */

/**
 * Coerces request parameters (body, path, query) using given Joi schema.
 *
 * Joi schema can be attached to route data in `parameters` key. Value
 * is map with `body`, `path`, `query` keys with schema as their values.
 *
 * Coerced values will be stored into `request.parameters` map under given key.
 * In case parameters are invalid, `next` won't be called and error response will be sent.
 *
 * inspiration: https://metosin.github.io/reitit/parameter_coercion.html
 */
function validateParameters(request) {
    const parameters = request.match.data.parameters;

    const responseParameters = {};

    const QuerySchema = parameters.query;
    if (QuerySchema != null) {
        const validationResult = QuerySchema.validate(request.query, {
            abortEarly: false,
        });
        if (validationResult.error) {
            return {
                type: commandResult.BAD_REQUEST,
                data: apiUtil.createQueryErrorObject(validationResult.error),
            };
        }

        responseParameters.query = validationResult.value;
    }

    const BodySchema = parameters.body;
    if (BodySchema != null) {
        const validationResult = BodySchema.validate(request.body, {
            abortEarly: false,
        });
        if (validationResult.error) {
            return {
                type: commandResult.BAD_REQUEST,
                data: apiUtil.createDataErrorObject(validationResult.error),
            };
        }

        responseParameters.body = validationResult.value;
    }

    const PathSchema = parameters.path;
    if (PathSchema != null) {
        const validationResult = PathSchema.validate(request.params, {
            abortEarly: false,
        });

        if (validationResult.error) {
            return {
                type: commandResult.BAD_REQUEST,
                data: {
                    errors: [{title: 'Invalid path params'}],
                },
            };
        }

        responseParameters.path = validationResult.value;
    }

    request.parameters = responseParameters;
}

/**
 * Useful in PUT operation.
 *
 * - Validates type properly by adding `type` attribute if not specified.
 * - Adds type info into `type` key of records.
 */
async function ensureDependentTypeInfo({plan, group}, request) {
    let validationError = null;
    const parameters = request.match.data.parameters;
    const data = request.parameters.body.data;
    const BodySchema = parameters.body;

    const newData = await Promise.all(
        mapWithKeys(async function (records, type) {
            const typeSchema = plan[group][type];
            if (typeSchema.type == null) {
                return records;
            }

            const dispatchColumn = typeSchema.type.dispatchColumn;
            const relationKey = typeSchema.type.key;

            const typeColumns = await q.typeColumns(
                {plan, group, type},
                records
            );

            const typeColumnsByKey = _.indexBy((r) => r.key, typeColumns);

            const recordsWithType = _.map((r) => {
                const val = _.get([r.key, dispatchColumn], typeColumnsByKey);

                if (
                    val === undefined ||
                    r.data.hasOwnProperty(dispatchColumn)
                ) {
                    return r;
                }

                return _.set(['data', dispatchColumn], val, r);
            }, records);

            if (BodySchema != null) {
                const validationResult = BodySchema.validate(
                    {data: {[type]: recordsWithType}},
                    {
                        abortEarly: false,
                    }
                );
                if (validationResult.error) {
                    validationError = validationResult.error;
                }
            }

            const recordsWithKeyAndRelation = _.map((r) => {
                const val = _.get(r.key, typeColumnsByKey);

                if (val == null) {
                    return r;
                }

                return _.set(
                    'type',
                    _.pick([relationKey, dispatchColumn], val),
                    r
                );
            }, recordsWithType);

            return recordsWithKeyAndRelation;
        }, data)
    );

    if (validationError == null) {
        request.parameters.body.data = _.zipObject(_.keys(data), newData);
        return;
    }

    return {
        type: commandResult.BAD_REQUEST,
        data: apiUtil.createDataErrorObject(validationError),
    };
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 *
 * @returns {Object<string, Command>}
 */
function createGroup(plan, group) {
    return {
        list: {
            parameters: {
                path: schema.listPath(plan, group),
                body: schema.listBody(plan, group),
            },
            handler: async function (request) {
                const handlerRequest = request.match
                    ? request
                    : Object.assign({}, request, {
                          match: {data: {parameters: this.parameters}},
                      });
                await customFields.updateSelectRequest(group, handlerRequest);
                const result = validateParameters(handlerRequest);
                if (result != null) {
                    return result;
                }

                return api.list({plan, group}, handlerRequest);
            },
        },
        create: {
            parameters: {
                body: schema.createBody(plan, group),
            },
            handler: async function (request) {
                const handlerRequest = request.match
                    ? request
                    : Object.assign({}, request, {
                          match: {data: {parameters: this.parameters}},
                      });
                const validationResult = validateParameters(handlerRequest);
                if (validationResult != null) {
                    return validationResult;
                }

                const customFieldResult =
                    await customFields.modifyCustomFieldRequest(
                        {plan, group},
                        handlerRequest
                    );
                if (customFieldResult != null) {
                    return customFieldResult;
                }

                const translationResult =
                    await translation.modifyTranslationRequest(
                        {plan, group},
                        handlerRequest
                    );
                if (translationResult != null) {
                    return translationResult;
                }

                return api.create({plan, group}, handlerRequest);
            },
        },
        update: {
            parameters: {
                body: schema.updateBody(plan, group),
            },
            handler: async function (request) {
                const handlerRequest = request.match
                    ? request
                    : Object.assign({}, request, {
                          match: {data: {parameters: this.parameters}},
                      });
                const validationResult = validateParameters(handlerRequest);
                if (validationResult != null) {
                    return validationResult;
                }

                const dependentTypeInfoResult = await ensureDependentTypeInfo(
                    {plan, group},
                    handlerRequest
                );
                if (dependentTypeInfoResult != null) {
                    return dependentTypeInfoResult;
                }

                const customFieldResult =
                    await customFields.modifyCustomFieldRequest(
                        {plan, group},
                        handlerRequest
                    );
                if (customFieldResult != null) {
                    return customFieldResult;
                }

                const translationResult =
                    await translation.modifyTranslationRequest(
                        {plan, group},
                        handlerRequest
                    );
                if (translationResult != null) {
                    return translationResult;
                }

                return api.update({plan, group}, handlerRequest);
            },
        },
        delete: {
            parameters: {body: schema.deleteBody(plan, group)},
            handler: async function (request) {
                const handlerRequest = request.match
                    ? request
                    : Object.assign({}, request, {
                          match: {data: {parameters: this.parameters}},
                      });
                const validationResult = validateParameters(handlerRequest);
                if (validationResult != null) {
                    return validationResult;
                }

                return api.deleteRecords({plan, group}, handlerRequest);
            },
        },
    };
}

/**
 * @param {import('./compiler').Plan} plan
 *
 * @returns {Object<string, Object<string, Command>>}
 */
function createAll(plan) {
    const groups = Object.keys(plan);

    return groups.reduce(function (config, group) {
        config[group] = createGroup(plan, group);

        return config;
    }, {});
}

module.exports = {
    createAll,
};
