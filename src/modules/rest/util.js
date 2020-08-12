const _ = require('lodash/fp');

const mapValuesWithKey = _.mapValues.convert({cap: false});
const eachWithKey = _.each.convert({cap: false});

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 * @param {string} type
 *
 * @returns {Object<string, import('./compiler').Column>}
 */
function restrictedColumns(plan, group, type) {
    const columns = plan[group][type].columns;

    return _.pickBy((c) => c.hasOwnProperty('relation'), columns);
}

/**
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 * @param {object} data
 * @param {string} permission
 *
 * @returns {import('../../permission').Permission[]}
 */
function requiredColumnPermissions(plan, group, data, permission) {
    const restrictedColumnsByType = mapValuesWithKey(function (v, type) {
        return restrictedColumns(plan, group, type);
    }, data);

    const keysByGroupByType = {};

    eachWithKey(function (records, type) {
        const restrictedColumns = restrictedColumnsByType[type];
        const restrictedColumnNames = _.keys(restrictedColumns);

        _.each((record) => {
            const colValuesToCheck = _.pickBy(
                (val) => val != null,
                _.pick(restrictedColumnNames, record.data)
            );

            _.each(([prop, value]) => {
                const column = restrictedColumns[prop];

                const resourceGroup = column.relation.resourceGroup;
                const resourceType = column.relation.resourceType;

                if (keysByGroupByType[resourceGroup] == null) {
                    keysByGroupByType[resourceGroup] = {};
                }

                if (keysByGroupByType[resourceGroup][resourceType] == null) {
                    keysByGroupByType[resourceGroup][resourceType] = [];
                }

                keysByGroupByType[resourceGroup][resourceType].push(value);
            }, _.entries(colValuesToCheck));
        }, records);
    }, data);

    return _.flatMap(([group, keysByType]) => {
        return _.map(([type, keys]) => {
            return {
                resourceGroup: group,
                resourceType: type,
                permission: permission,
                resourceKey: _.uniq(keys),
            };
        }, _.entries(keysByType));
    }, _.entries(keysByGroupByType));
}

module.exports = {
    restrictedColumns,
    requiredColumnPermissions,
};
