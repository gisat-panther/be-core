const _ = require('lodash/fp');

const mapValuesWithKey = _.mapValues.convert({cap: false});

/**
 * @param {{plan: import('../rest/compiler').Plan}} context
 * @param {Permissions} permissions
 *
 * @returns {import('./index').Permissions}
 */
function compile({plan}, permissions) {
    return _.mapValues((permission) => {
        if (permission.targets == null) {
            return permission;
        }

        return _.update(
            'targets',
            (targets) =>
                mapValuesWithKey((groupData, group) => {
                    return mapValuesWithKey((typeData, type) => {
                        return _.set(
                            'table',
                            plan[group][type].table,
                            typeData
                        );
                    }, groupData);
                }, targets),
            permission
        );
    }, permissions);
}

module.exports = {
    compile,
};
