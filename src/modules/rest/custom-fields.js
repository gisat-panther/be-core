const Joi = require('../../joi');
const qb = require('@imatic/pgqb');
const _ = require('lodash/fp');
const {SQL} = require('sql-template-strings');

const mapWithKey = _.map.convert({cap: false});

function schema() {
    return Joi.object().unknown(true);
}

function listQuery(alias) {
    return qb.select([`${alias}.__customColumns`]);
}

function validDataNames({plan, group, type}) {
    const typeSchema = plan[group][type];

    return _.uniq(
        _.reduce(
            _.concat,
            [],
            [
                Object.keys(_.getOr({}, 'columns', typeSchema)),
                mapWithKey((rel, name) => {
                    switch (rel.type) {
                        case 'manyToMany':
                            return name + 'Keys';
                        case 'manyToOne':
                            return name + 'Key';
                    }

                    throw new Error(`Unspported relation type: ${rel.type}`);
                }, _.getOr({}, 'relations', typeSchema)),
                _.flatMap(
                    (type) => Object.keys(_.getOr([], 'columns', type)),
                    _.getOr({}, ['type', 'types'], typeSchema)
                ),
            ]
        )
    );
}

function create({plan, group, type}, records) {
    const validNames = validDataNames({plan, group, type});
    const values = _.map(
        (record) => [
            qb.val.inlineParam(
                JSON.stringify(_.omit(validNames, record.data)),
                records
            ),
        ],
        records
    );

    return qb.merge(qb.columns(['__customColumns']), qb.values(values));
}

function update({plan, group, type}, record) {
    const validNames = validDataNames({plan, group, type});
    const value = JSON.stringify(_.omit(validNames, record.data));

    return qb.set([
        qb.expr.eq(
            '__customColumns',
            qb.val.raw(SQL`("__customColumns" || ${value}::jsonb)`)
        ),
    ]);
}

function formatRow(row) {
    const customColumns = _.getOr({}, ['data', '__customColumns'], row);

    return _.update(
        'data',
        _.flow(_.omit('__customColumns'), _.merge(customColumns)),
        row
    );
}

module.exports = {
    schema,
    listQuery,
    create,
    update,
    formatRow,
    validDataNames,
};
