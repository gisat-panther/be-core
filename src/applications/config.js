const _ = require('lodash/fp');
const planCompiler = require('../modules/rest/compiler');
const generatedPermissionsCompiler = require('../modules/permissions/compiler');
const config = require('../../config');
const fs = require('fs');

/**
 * @typedef {import('../modules/rest/compiler').Plan} PlanConfig
 * @typedef {import('../modules/routing/index').RouteData[]} RouterConfig
 *
 * @callback PermissionsConfig
 * @param {{plan: import('../modules/rest/compiler').Plan}} opts
 * @returns {import('../modules/permissions/compiler').Permissions}
 *
 * @typedef Config
 * @property {PlanConfig} plan
 * @property {RouterConfig} router
 * @property {PermissionsConfig} generatedPermissions
 *
 * @typedef Appconfig
 * @property {import('../modules/rest/compiler').Plan} plan
 * @property {import('../modules/routing/index').RouteData[]} router
 * @property {import('../modules/permissions/compiler').Permissions} generatedPermissions
 */

/**
 * @param {Config} config
 *
 * @returns {Function}
 */
function getAppendHandler(config) {
    if (_.isArray(config)) {
        return _.concat;
    }

    if (_.isFunction(config)) {
        return function (app1, app2) {
            return function () {
                const config1 = app1(...arguments);
                const config2 = app2(...arguments);
                const appendHandler = getAppendHandler(config1);

                return appendHandler(config1, config2);
            };
        };
    }

    return (app1, app2) => Object.assign({}, app1, app2);
}

/**
 * @param {Config} result
 * @param {Config} application
 *
 * @returns {Config}
 */
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
 *
 * @returns {Config}
 */
function mergeApplications(...applications) {
    return _.reduce(appendApplication, {}, applications);
}

function getExternalApplications() {
    const dir = config.externalApplications;
    if (dir == null) {
        return [];
    }

    return fs
        .readdirSync(dir, {
            withFileTypes: true,
        })
        .filter((f) => f.isDirectory())
        .map((f) => dir + '/' + f.name + '/index.js')
        .filter((path) => fs.existsSync(path))
        .map((path) => require(path));
}

/**
 * @returns {Appconfig}
 */
function get() {
    const config = mergeApplications(
        {
            generatedPermissions: function () {
                return {};
            },
        },
        require('./core/index'),
        require('./demo/index'),
        require('./data/index'),
        require('./timeSerieData'),
        ...getExternalApplications()
    );

    config.plan = planCompiler.compile(config.plan);
    config.generatedPermissions = generatedPermissionsCompiler.compile(
        {plan: config.plan},
        config.generatedPermissions({plan: config.plan})
    );

    return config;
}

const cfg = get();

module.exports = {
    get: () => cfg,
};
