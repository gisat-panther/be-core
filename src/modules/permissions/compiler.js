const {flow} = require('lodash');
const _ = require('lodash/fp');
const hash = require('object-hash');

const mapValuesWithKey = _.mapValues.convert({cap: false});

/**
 * @typedef TargetType
 * @property {string} resourceGroup
 * @property {string} resourceType
 * @property {string} resourceKeyPath
 *
 * @typedef Target
 * @property {string} table
 * @property {TargetType=} targetType Target of which permission will be created (defaults to current row).
 *
 * @typedef {Object<string, Object<string, Target>>} Targets
 *
 * @typedef ColumnsPermission
 * @property {Targets} targets Types to which `targetPermissions` will be assignled
 * @property {(data: object) => string} groupName Permission will be assigned to returned specified group.
 * @property {string[]} targetPermissions Permissions to assign to `targets` or `targetGroups`
 * @property {boolean} assignGroup If true, target has to be user type. Target will be assigned to group given by `groupName`
 * @property {string[]} sourceGroups Groups that will have `targetPermissions` on `targetGroups`
 * @property {string[]} targetGroups Groups that will be accessible with `targetPermissions` by `sourceGroups`
 * @property {string} hash Hash of the config - if changed, permissions are regenerated
 *
 * @typedef {ColumnsPermission} Permission
 *
 * @typedef {Object<string, Permission>} Permissions
 */

/**
 * @param {{plan: import('../rest/compiler').Plan}} context
 * @param {Permission} permission
 *
 * @returns {Permission}
 */
function enrichPermissionTargets({plan}, permission) {
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
                        _.getOr(type, [group, type, 'table'], plan),
                        typeData
                    );
                }, groupData);
            }, targets),
        permission
    );
}

/**
 * @param {Permission} permission
 *
 * @returns {Permission}
 */
function enrichPermissionWithHash(permission) {
    return _.set(
        'hash',
        hash(
            _.pick(
                [
                    'sourceGroups',
                    'targetGroups',
                    'targetPermissions',
                    'targets',
                    'assignGroup',
                ],
                permission
            )
        ),
        permission
    );
}

/**
 * @param {{plan: import('../rest/compiler').Plan}} context
 * @param {Permissions} permissions
 *
 * @returns {Permissions}
 */
function compile({plan}, permissions) {
    return _.mapValues((permission) => {
        return flow(
            (permission) => enrichPermissionTargets({plan}, permission),
            enrichPermissionWithHash
        )(permission);
    }, permissions);
}

module.exports = {
    compile,
};
