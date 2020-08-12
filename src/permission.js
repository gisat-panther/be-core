const _ = require('lodash/fp');
const qb = require('@imatic/pgqb');
const db = require('./db');

/**
 * @typedef {object} Permission
 * @property {string} resourceGroup
 * @property {string} resourceType
 * @property {string} permission
 * @property {Array<string|undefined>=} resourceKey - All resource keys we need access to
 *   (helpful if user doesn't have global access to the resource, but has access to individual resources)
 */

/**
 * @param {Permission} permission
 *
 * @returns {import('@imatic/pgqb').Expr}
 */
function permissionExpr(permission) {
    const keys = (permission.resourceKey || []).map((k) =>
        qb.expr.eq('p.resourceKey', qb.val.inlineParam(k))
    );

    return qb.expr.and(
        qb.expr.eq(
            'p.resourceGroup',
            qb.val.inlineParam(permission.resourceGroup)
        ),
        qb.expr.eq(
            'p.resourceType',
            qb.val.inlineParam(permission.resourceType)
        ),
        qb.expr.eq('p.permission', qb.val.inlineParam(permission.permission)),
        qb.expr.or(qb.expr.null('p.resourceKey'), ...keys)
    );
}

/**
 * @param {Permission[]} rows
 *
 * @returns {{Object<string, Object<string, Object<string, Set<string>>>>}}
 */
function convertRows(rows) {
    const res = {};
    rows.forEach((row) => {
        if (res[row.resourceGroup] == null) {
            res[row.resourceGroup] = {};
        }

        if (res[row.resourceGroup][row.resourceType] == null) {
            res[row.resourceGroup][row.resourceType] = {};
        }

        if (res[row.resourceGroup][row.resourceType][row.permission] == null) {
            res[row.resourceGroup][row.resourceType][
                row.permission
            ] = new Set();
        }

        res[row.resourceGroup][row.resourceType][row.permission].add(
            row.resourceKey
        );
    });

    return res;
}

/**
 * @param {Permission} permission
 *
 * @returns {(string|null)[]}
 */
function requiredKeys(permission) {
    if (!permission.hasOwnProperty('resourceKey')) {
        return [null];
    }

    if (!_.isArray(permission.resourceKey)) {
        return [permission.resourceKey];
    }

    return permission.resourceKey;
}

/**
 * @param {Object} user
 * @param {Array<Permission>} permissions
 *
 * @returns {boolean} `true` if `user` has all `permissions`, `false` otherwise.
 */
async function userHasAllPermissions(user, permissions) {
    if (user == null || permissions.length === 0) {
        return Promise.resolve(false);
    }

    const sqlMap = qb.merge(
        qb.select([
            'p.resourceGroup',
            'p.resourceType',
            'p.permission',
            'p.resourceKey',
        ]),
        qb.from('user.v_userPermissions', 'p'),
        qb.where(
            qb.expr.and(
                qb.expr.or(...permissions.map(permissionExpr)),
                qb.expr.eq('p.userKey', qb.val.inlineParam(user.realKey))
            )
        )
    );

    const res = await db.query(qb.toSql(sqlMap));
    const comparisonRes = convertRows(res.rows);

    return permissions.every((permission) => {
        const grantedKeys = _.getOr(
            new Set(),
            [
                permission.resourceGroup,
                permission.resourceType,
                permission.permission,
            ],
            comparisonRes
        );

        return (
            grantedKeys.has(null) ||
            requiredKeys(permission).every((k) => grantedKeys.has(k))
        );
    });
}

module.exports = {
    userHasAllPermissions,
};
