const _ = require('lodash/fp');

const mapValuesWithKey = _.mapValues.convert({cap: false});
const eachWithKey = _.each.convert({cap: false});

function restrictedColumns(plan, group, type) {
    const columns = plan[group][type].columns;

    return _.pickBy((c) => c.hasOwnProperty('relation'), columns);
}

function requiredColumnPermissions(plan, group, data) {
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
                permission: 'create',
                resourceKey: _.uniq(keys),
            };
        }, _.entries(keysByType));
    }, _.entries(keysByGroupByType));
}

module.exports = {
    restrictedColumns,
    requiredColumnPermissions,
};
