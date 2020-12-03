module.exports = function ({plan}) {
    return {
        demo__target_group: {
            /*
             * Users in `sourceGroups` have `view` permission on users from `targetGroups`.
             */
            sourceGroups: ['group1'],
            targetGroups: ['targetGroup'],
            targetPermissions: ['view'],
        },
        demo__email_domain: {
            /*
             * Each user is assigned to group created based on email domain.
             * Uses within same group based on email domain will have `targetPermissions`.
             */
            targets: {
                user: {
                    user: {columns: ['email']},
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
            /*
             * Targets will be part of group based on application key.
             * Permissions of the group will be `targetPermissions`.
             */
            targets: {
                // todo: generate targets from plan
                relations: {
                    spatial: {columns: ['applicationKey']},
                    attribute: {columns: ['applicationKey']},
                },
            },
            groupName: ({applicationKey}) => {
                return (
                    'generated:demo:application:' +
                    (applicationKey == null ? '' : applicationKey)
                );
            },
            targetPermissions: ['view', 'create', 'update', 'delete'],
        },
    };
};
