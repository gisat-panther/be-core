const SQL = require('sql-template-strings');

const db = require('../../../src/db');

function getUserGroups(user) {
    return db
        .query(
            SQL`
                SELECT 
                    g.key, g.name 
                FROM 
                    "user".groups AS g 
                INNER JOIN 
                    "user"."userGroups" AS ug ON ug."groupKey" = g.key 
                WHERE 
                    ug."userKey" = ${user.realKey}
            `
        )
        .then((pgResult) => pgResult.rows);
}

function getUserPermissions(user) {
    return db
        .query(
            SQL`
                SELECT
                    p."resourceKey",
                    p.permission
                FROM
                    "user".permissions AS p
                WHERE
                    p."resourceType" = 'worldCerealProductMetadata'
                    AND p."resourceGroup" = 'specific'
                    AND p.key IN (
                        SELECT
                            "permissionKey"
                        FROM
                            "user"."userPermissions" AS up
                        WHERE
                            up."userKey" = ${user.realKey}
                        
                        UNION
                        
                        SELECT 
                            "permissionKey"
                        FROM
                            "user"."groupPermissions" AS gp
                        INNER JOIN
                            "user"."userGroups" AS ug
                        ON
                            ug."groupKey" = gp."groupKey"
                        WHERE
                            ug."userKey" = ${user.realKey}
                    )
            `
        )
        .then((pgResult) => pgResult.rows);
}

function hasUserPermission(user, resourceKey, permission) {
    const query = SQL`
                    SELECT
                        *
                    FROM
                        "user".permissions AS p
                    WHERE
                        p."resourceType" = 'worldCerealProductMetadata'
                        AND p."resourceGroup" = 'specific'
                        AND p.permission = ${permission} `;

    if (resourceKey) {
        query.append(SQL`AND p."resourceKey" = ${resourceKey} `);
    } else {
        query.append(SQL`AND p."resourceKey" IS NULL `);
    }        

    query.append(SQL`AND p.key IN (
                        SELECT
                            "permissionKey"
                        FROM
                            "user"."userPermissions" AS up
                        WHERE
                            up."userKey" = ${user.realKey}
                        
                        UNION
                        
                        SELECT 
                            "permissionKey"
                        FROM
                            "user"."groupPermissions" AS gp
                        INNER JOIN
                            "user"."userGroups" AS ug
                        ON
                            ug."groupKey" = gp."groupKey"
                        WHERE
                            ug."userKey" = ${user.realKey}
                    )
                    `
    );

    query.setName('userHasPermissionQuery');

    return db
        .query(query)
        .then((pgResult) => !!(pgResult.rows.length));
}

module.exports = {
    getUserGroups,
    getUserPermissions,
    hasUserPermission
}