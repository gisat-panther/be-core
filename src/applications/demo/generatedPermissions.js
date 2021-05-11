const _ = require('lodash/fp');

function isApplicationRelation(relation) {
    return (
        relation.resourceGroup === 'application' &&
        relation.resourceType === 'application'
    );
}

function typeApplicationRelations(type) {
    return _.filter(isApplicationRelation, _.getOr({}, 'relations', type));
}

function applicationKeyTargets(plan) {
    const targets = {};
    for (const [groupName, group] of Object.entries(plan)) {
        for (const [typeName, type] of Object.entries(group)) {
            const relations = typeApplicationRelations(type);
            if (relations.length === 0) {
                continue;
            }

            if (relations.length !== 1) {
                throw new Error(
                    `Type "${groupName}.${typeName}" is expected to have one or none application relations, but ${relations.length} found.`
                );
            }

            const relation = _.head(relations);
            if (relation.inverseKey !== 'applicationKey') {
                throw new Error(
                    `Inverse key of application relation is expected to be 'applicationKey', but it is ${relation.inverseKey}`
                );
            }

            const [rschema, rtable] = relation.relationTable.split('.');
            if (targets[rschema] == null) {
                targets[rschema] = {};
            }

            targets[rschema][rtable] = {
                targetType: {
                    resourceGroup: groupName,
                    resourceType: typeName,
                    resourceKeyPath: relation.ownKey,
                },
            };
        }
    }

    return targets;
}

module.exports = function ({plan}) {
    return {
        demo__target_group: {
            /*
             * Users in `sourceGroups` have `view` permission on users from `targetGroups`.
             */
            sourceGroups: ['demo_sourceGroup'],
            targetGroups: ['demo_targetGroup'],
            targetPermissions: ['view'],
        },
        demo__email_domain: {
            /*
             * Each user is assigned to group created based on email domain.
             * Uses within same group based on email domain will have `targetPermissions`.
             */
            targets: {
                user: {
                    user: {},
                },
            },
            groupName: ({email}) => {
                return (
                    'generated:demo:email_domain:' +
                    (email == null ? '' : email).match(/[^@]*$/)
                );
            },
            assignGroup: true, // target needs to be user type
            targetPermissions: ['view'],
        },
        demo__application: {
            targets: applicationKeyTargets(plan),
            /*
            todo fix bellow
            - applicationKeyTargets return empty object for this plan which cause error during startup "Cannot convert undefined or null to object"
             */

            /*
             * Targets will be part of group based on application key.
             * Permissions of the group will be `targetPermissions`.
             */
            groupName: ({applicationKey}) => {
                if (applicationKey === null) {
                    return null;
                }

                return 'generated:demo:application:' + applicationKey;
            },
            targetPermissions: ['view', 'create', 'update', 'delete'],
        },
    };
};
