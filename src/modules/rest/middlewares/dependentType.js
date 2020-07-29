const apiUtil = require('../../../util/api');
const {HttpError} = require('../../error');
const _ = require('lodash/fp');
const q = require('../query');

const mapWithKeys = _.map.convert({cap: false});

/**
 * Useful in PUT operation.
 *
 * - Validates type properly by adding `type` attribute if not specified.
 * - Adds type info into `type` key of records.
 */
function createDependentTypeMiddleware({plan, group}) {
    return async function (request, response, next) {
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
                    const val = _.get(
                        [r.key, dispatchColumn],
                        typeColumnsByKey
                    );

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
            return next();
        }

        return next(
            new HttpError(400, apiUtil.createDataErrorObject(validationError))
        );
    };
}

module.exports = createDependentTypeMiddleware;
