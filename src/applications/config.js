const _ = require('lodash/fp');
const planCompiler = require('../modules/rest/compiler');
const generatedPermissionsCompiler = require('../modules/permissions/compiler');

function getAppendHandler(config) {
    if (_.isArray(config)) {
        return _.concat;
    }

    if (_.isFunction(config)) {
        return function (app1, app2) {
            return function () {
                const config1 = app1(arguments);
                const config2 = app2(arguments);
                const appendHandler = getAppendHandler(config1);

                return appendHandler(config1, config2);
            };
        };
    }

    return _.merge;
}

function appendApplication(result, application) {
    return _.reduce(
        function (result, k) {
            if (result[k] == null) {
                return _.set(k, application[k], result);
            }

            const appendHandler = getAppendHandler(result[k]);

            return _.set(k, appendHandler(result[k], application[k]), result);
        },
        result,
        _.keys(application)
    );
}

/**
 * Merges given applications into one config.
 */
function mergeApplications(...applications) {
    return _.reduce(appendApplication, {}, applications);
}

function get() {
    const config = mergeApplications(
        require('./core/index'),
        require('./demo/index')
    );

    config.plan = planCompiler.compile(config.plan);
    config.generatedPermissions = generatedPermissionsCompiler.compile(
        {plan: config.plan},
        config.generatedPermissions({plan: config.plan})
    );

    return config;
}

module.exports = {
    get,
};
