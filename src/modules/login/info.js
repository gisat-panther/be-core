const q = require('./query');
const auth = require('./auth');
const _ = require('lodash');

const UserType = {
    USER: 'user',
    GUEST: 'guest',
};

/**
 * @param {{resourceGroup: string, resourceType: string, permission: string}[]} permissions
 * @param {object} plan
 *
 * @returns {Object<string, Object<string, Object<string, true>>>}
 */
function formatPermissions(permissions, plan) {
    const permissionsByResourceGroup = _.groupBy(
        permissions,
        (p) => p.resourceGroup
    );

    const formattedPermissions = {};
    _.each(plan, (dataType, group) => {
        formattedPermissions[group] = {};
        const permissionsByResourceType = _.groupBy(
            permissionsByResourceGroup[group],
            (p) => p.resourceType
        );
        _.each(_.keys(dataType), (resourceType) => {
            if (permissionsByResourceType[resourceType] == null) {
                return;
            }

            const permissions = Object.fromEntries(
                _.map(permissionsByResourceType[resourceType], (v) => [
                    v.permission,
                    true,
                ])
            );
            formattedPermissions[group][resourceType] = permissions;
        });
    });

    return formattedPermissions;
}

async function get(user, token, plan) {
    const [userInfo, permissions] = await Promise.all([
        q.getUserInfoByKey(user.realKey),
        q.userPermissionsByKey(user.realKey),
    ]);

    return {
        key: user.key,
        data: {
            name: _.get(userInfo, 'name', null),
            email: _.get(userInfo, 'email', null),
            phone: _.get(userInfo, 'phone', null),
        },
        permissions: formatPermissions(permissions, plan),
        authToken: token,
    };
}

async function getWithToken(plan, user) {
    const token = await auth.createAuthToken(
        auth.tokenPayload({
            ...user,
            ...{type: UserType.USER, realKey: user.key},
        })
    );

    return get(Object.assign({}, user, {realKey: user.key}), token, plan);
}

module.exports = {
    get,
    getWithToken,
};
