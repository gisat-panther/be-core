const db = require('../../db');
const qb = require('@imatic/pgqb');
const _ = require('lodash');
const _fp = require('lodash/fp');
const {SQL} = require('sql-template-strings');

const GUEST_KEY = 'cad8ea0d-f95e-43c1-b162-0704bfc1d3f6';

const filterOperatorToSqlExpr = {
    timefrom: function (filter) {
        return qb.expr.gte(filter.column, qb.val.inlineParam(filter.value));
    },
    timeto: function (filter) {
        return qb.expr.lte(filter.column, qb.val.inlineParam(filter.value));
    },
    like: function (filter) {
        return qb.expr.ilike(
            filter.column,
            qb.val.inlineParam(`%${filter.value}%`)
        );
    },
    in: function (filter) {
        return qb.expr.in(
            filter.column,
            filter.value.map((v) => qb.val.inlineParam(v))
        );
    },
    notin: function (filter) {
        return qb.expr.notin(
            filter.column,
            filter.value.map((v) => qb.val.inlineParam(v))
        );
    },
    eq: function (filter) {
        if (filter.value === null) {
            return qb.expr.null(filter.column);
        }

        return qb.expr.eq(filter.column, qb.val.inlineParam(filter.value));
    },
};

function getDb(client) {
    return client || db;
}

/**
 * Converts filters to the structure:
 * {
 *   column: <string>
 *   value: <any>
 *   operator: <string>
 * }
 */
function createFilters(requestFilter, columnToAliases) {
    const filters = [];
    _.forEach(requestFilter, (filterData, field) => {
        filters.push(
            _.map(columnToAliases[field], (alias) => {
                const column = `${alias}.${field}`;

                if (_.isObject(filterData)) {
                    const type = Object.keys(filterData)[0];

                    return {
                        column: column,
                        value: filterData[type],
                        operator: type,
                    };
                }

                return {
                    column: column,
                    value: filterData,
                    operator: 'eq',
                };
            })
        );
    });

    return filters;
}

function filtersToSqlExpr(filters) {
    const exprs = filters
        .map((filter) => {
            const filters = _.isArray(filter) ? filter : [filter];

            const exprs = _.map(filters, (filter) => {
                const createExpr = filterOperatorToSqlExpr[filter.operator];
                if (createExpr) {
                    return createExpr(filter);
                }
            }).filter((f) => f != null);

            if (exprs.length === 1) {
                return exprs[0];
            } else if (exprs.length > 1) {
                return qb.expr.or(...exprs);
            }
        })
        .filter((f) => f != null);

    if (exprs.length === 0) {
        return {};
    }

    return qb.where(qb.expr.and(...exprs));
}

function sortToSqlExpr(requestSort, alias) {
    if (requestSort == null) {
        return {};
    }

    const exprs = requestSort.map(([field, order]) => {
        return qb.orderBy(
            `${alias}.${field}`,
            order === 'ascending' ? 'ASC' : 'DESC'
        );
    });

    if (exprs.length === 0) {
        return {};
    }

    return qb.append(...exprs);
}

function pageToQuery(page) {
    if (page == null) {
        return {};
    }

    return qb.merge(qb.limit(page.limit), qb.offset(page.offset));
}

function relationsQuery({plan, group, type}, alias) {
    const relations = plan[group][type].relations;

    const queries = _.map(relations, (rel, name) => {
        switch (rel.type) {
            case 'manyToMany': {
                const relAlias = 'rel_' + name;
                const column = name + 'Keys';
                const ownKey = `${relAlias}.${rel.ownKey}`;

                return qb.merge(
                    qb.select([
                        qb.val.raw(
                            `ARRAY_AGG(DISTINCT "${relAlias}"."${rel.inverseKey}" ORDER BY "${relAlias}"."${rel.inverseKey}") FILTER (WHERE "${relAlias}"."${rel.inverseKey}" IS NOT NULL) AS "${column}"`
                        ),
                    ]),
                    qb.joins(
                        qb.leftJoin(
                            rel.relationTable,
                            relAlias,
                            qb.expr.eq(ownKey, `${alias}.key`)
                        )
                    )
                );
            }
            case 'manyToOne': {
                const relAlias = 'rel_' + name;
                const column = name + 'Key';
                const ownKey = `${relAlias}.${rel.ownKey}`;

                return qb.merge(
                    qb.select([
                        qb.expr.as(
                            qb.val.raw(
                                `MIN("${relAlias}"."${rel.inverseKey}"::text)`
                            ),
                            column
                        ),
                    ]),
                    qb.joins(
                        qb.leftJoin(
                            rel.relationTable,
                            relAlias,
                            qb.expr.eq(ownKey, `${alias}.key`)
                        )
                    )
                );
            }
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    });

    if (queries.length === 0) {
        return {};
    }

    return qb.append(...queries);
}

function listPermissionQuery({user, type}, alias) {
    if (user == null) {
        return {};
    }

    return qb.merge(
        qb.joins(
            qb.join(
                'user.v_userPermissions',
                'tp',
                qb.expr.and(
                    qb.expr.eq('tp.resourceType', qb.val.inlineParam(type)),
                    qb.expr.eq('tp.permission', qb.val.inlineParam('view')),
                    qb.expr.or(
                        qb.expr.null('tp.resourceKey'),
                        qb.expr.eq(
                            'tp.resourceKey',
                            qb.val.raw(`"${alias}"."key"::text`)
                        )
                    )
                )
            )
        ),
        qb.where(qb.expr.eq('tp.userKey', qb.val.inlineParam(user.realKey)))
    );
}

function specificUserPermissionsQuery(userKey, type, alias, permissionsAlias) {
    const joinAlias = 'rela_' + permissionsAlias;

    return qb.merge(
        qb.select([
            qb.expr.as(
                qb.val.raw(`array_agg(DISTINCT "${joinAlias}"."permission")`),
                permissionsAlias
            ),
        ]),
        qb.joins(
            qb.leftJoin(
                'user.v_userPermissions',
                joinAlias,
                qb.expr.and(
                    qb.expr.eq(
                        `${joinAlias}.resourceType`,
                        qb.val.inlineParam(type)
                    ),
                    qb.expr.or(
                        qb.expr.null('tp.resourceKey'),
                        qb.expr.eq(
                            'tp.resourceKey',
                            qb.val.raw(`"${alias}"."key"::text`)
                        )
                    ),
                    qb.expr.eq(
                        `${joinAlias}.userKey`,
                        qb.val.inlineParam(userKey)
                    )
                )
            )
        )
    );
}

function listUserPermissionsQuery({user, type}, alias) {
    if (user == null) {
        return {};
    }

    return qb.append(
        specificUserPermissionsQuery(
            user.realKey,
            type,
            alias,
            'active_user_p'
        ),
        specificUserPermissionsQuery(GUEST_KEY, type, alias, 'guest_user_p')
    );
}

async function lastChange({group, type}) {
    const sqlMap = qb.merge(
        qb.select([qb.expr.as('a.action_tstamp_stm', 'change')]),
        qb.from('audit.logged_actions', 'a'),
        qb.where(
            qb.expr.and(
                qb.expr.eq('a.schema_name', qb.val.inlineParam(group)),
                qb.expr.eq('a.table_name', qb.val.inlineParam(type))
            )
        ),
        qb.orderBy('a.action_tstamp_stm', 'DESC'),
        qb.limit(1)
    );

    const res = await db.query(qb.toSql(sqlMap));

    return _.first(_.map(res.rows, (row) => row.change));
}

function listDependentTypeAlias(table) {
    return '_t_' + table;
}

function listDependentTypeQuery({plan, group, type}, alias) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return {};
    }

    const relationKey = typeSchema.type.key;
    const dispatchColumn = typeSchema.type.dispatchColumn;

    const selectByColumn = {};

    const joins = qb.append(
        ..._fp.map((table) => {
            const al = listDependentTypeAlias(table);
            const columns = _fp.getOr(
                {},
                ['type', 'types', table, 'columns'],
                typeSchema
            );

            _.forEach(columns, (c, name) => {
                selectByColumn[name] = selectByColumn[name] || [];
                selectByColumn[name].push(c.selectExpr({alias: al}));
            });

            return qb.merge(
                qb.joins(
                    qb.leftJoin(
                        `${group}.${table}`,
                        al,
                        qb.expr.and(
                            qb.expr.eq(
                                `${alias}.${dispatchColumn}`,
                                qb.val.inlineParam(table)
                            ),
                            qb.expr.eq(`${alias}.${relationKey}`, `${al}.key`)
                        )
                    )
                ),
                qb.groupBy([`${al}.key`])
            );
        }, _.keys(typeSchema.type.types))
    );

    return qb.merge(
        qb.select(
            _.map(selectByColumn, (selects, name) => {
                return qb.expr.as(qb.expr.fn('COALESCE', ...selects), name);
            })
        ),
        joins
    );
}

function cleanDependentTypeCols({plan, group, type}, rows) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return rows;
    }

    const allTypeCols = _fp.uniq(
        _fp.flatMap((t) => _fp.keys(t.columns), typeSchema.type.types)
    );

    const omitColByType = _fp.mapValues(function (type) {
        return _fp.difference(allTypeCols, _fp.keys(type.columns));
    }, typeSchema.type.types);
    omitColByType[null] = allTypeCols;

    const dispatchColumn = typeSchema.type.dispatchColumn;

    return _fp.map((row) => {
        const currentType = row[dispatchColumn];

        return _fp.omit(omitColByType[currentType], row);
    }, rows);
}

function list({plan, group, type, client, user}, {sort, filter, page}) {
    const typeSchema = plan[group][type];
    const columns = typeSchema.context.list.columns;
    const table = _.get(typeSchema, 'table', type);
    const columnsConfig = plan[group][type].columns;

    const columnToAliases = _.reduce(
        [
            _.zipObject(columns, _.fill(new Array(columns.length), ['t'])),
            ..._.map(_.get(typeSchema, ['type', 'types'], {}), (t, name) => {
                const columns = _.get(t, ['context', 'list', 'columns'], []);

                return _.zipObject(
                    columns,
                    _.fill(new Array(columns.length), [
                        listDependentTypeAlias(name),
                    ])
                );
            }),
        ],
        function (res, next) {
            return _.mergeWith(res, next, function (x, y) {
                if (x === undefined) {
                    return y;
                }

                return _.concat(x, y);
            });
        },
        {}
    );

    const sqlMap = qb.append(
        qb.merge(
            qb.select(
                columns.map((c) => columnsConfig[c].selectExpr({alias: 't'}))
            ),
            qb.from(`${group}.${table}`, 't'),
            qb.groupBy(['t.key'])
        ),
        listPermissionQuery({user, type}, 't'),
        listUserPermissionsQuery({user, type}, 't'),
        listDependentTypeQuery({plan, group, type}, 't'),
        filtersToSqlExpr(createFilters(filter, columnToAliases)),
        relationsQuery({plan, group, type}, 't')
    );

    const countSqlMap = qb.merge(
        qb.select([qb.expr.as(qb.expr.fn('COUNT', qb.val.raw(1)), 'count')]),
        qb.from(qb.merge(sqlMap, qb.select(['t.key'])), '_gt')
    );

    const db = getDb(client);

    return Promise.all([
        db
            .query(
                qb.toSql(
                    qb.merge(
                        sqlMap,
                        sortToSqlExpr(sort, 't'),
                        pageToQuery(page)
                    )
                )
            )
            .then((res) => res.rows),
        db
            .query(qb.toSql(countSqlMap))
            .then((res) => _.get(res.rows[0], 'count', 0)),
    ]).then(([rows, count]) => ({
        rows: cleanDependentTypeCols({plan, group, type}, rows),
        count: Number(count),
    }));
}

function recordValues(record, columns, columnsConfig) {
    const data = {...record.data, ...{key: record.key}};

    return columns.map((c) => columnsConfig[c].modifyExpr({value: data[c]}));
}

function createDependentType({plan, group, type, client}, record) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return Promise.resolve(null);
    }

    const dispatchColumn = typeSchema.type.dispatchColumn;
    const dispatchValue = _fp.get(['data', dispatchColumn], record);
    if (dispatchValue == null) {
        return Promise.resolve(null);
    }

    const columnsConfig = typeSchema.type.types[dispatchValue].columns;
    const validColumns = new Set(Object.keys(columnsConfig));
    const columns = _.keys(record.data).filter((c) => validColumns.has(c));

    const sqlMap = qb.merge(
        qb.insertInto(`${group}.${dispatchValue}`),
        qb.columns(columns),
        qb.values([recordValues(record, columns, columnsConfig)]),
        qb.returning(['key'])
    );

    return getDb(client)
        .query(qb.toSql(sqlMap))
        .then((res) => res.rows.map((r) => r.key)[0]);
}

function updateDependentType({plan, group, type, client}, record) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return Promise.resolve(null);
    }

    const dispatchColumn = typeSchema.type.dispatchColumn;
    const dispatchValue = _fp.get(['type', dispatchColumn], record);
    if (dispatchValue == null) {
        return Promise.resolve(null);
    }

    const relationKey = typeSchema.type.key;
    const relationKeyValue = _fp.get(['type', relationKey], record);
    if (relationKeyValue == null) {
        return Promise.resolve(null);
    }

    const columnsConfig = typeSchema.type.types[dispatchValue].columns;
    const validColumns = new Set(Object.keys(columnsConfig));
    const columns = _.keys(record.data).filter((c) => validColumns.has(c));
    const data = _.pick(record.data, columns);

    const sqlMap = qb.merge(
        qb.update(`${group}.${dispatchValue}`),
        qb.set(updateExprs(data, columnsConfig)),
        qb.where(qb.expr.eq('key', qb.val.inlineParam(relationKeyValue))),
        qb.returning(['key'])
    );

    return getDb(client)
        .query(qb.toSql(sqlMap))
        .then((res) => res.rows.map((r) => r.key)[0]);
}

function deleteDependentType({plan, group, type, client}, record) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return Promise.resolve();
    }

    const dispatchColumn = typeSchema.type.dispatchColumn;
    const dispatchValue = _fp.get(['type', dispatchColumn], record);
    if (dispatchValue == null) {
        return Promise.resolve();
    }

    const relationKey = typeSchema.type.key;
    const relationKeyValue = _fp.get(['type', relationKey], record);
    if (relationKeyValue == null) {
        return Promise.resolve();
    }

    return client.query(
        SQL``
            .append(`DELETE FROM "${group}".${dispatchValue} WHERE`)
            .append(SQL` "key" = ${relationKeyValue}`)
    );
}

async function create({plan, group, type, client}, records) {
    const typeSchema = plan[group][type];
    const typeKey = _fp.get(['type', 'key'], typeSchema);

    const dependentTypes =
        typeKey == null
            ? null
            : await Promise.all(
                  records.map(async (r) => {
                      return await createDependentType({plan, group, type}, r);
                  })
              );

    const columnsConfig = typeSchema.columns;
    const validColumns = new Set(Object.keys(columnsConfig));
    const columns = ['key', ...Object.keys(records[0].data)].filter((c) =>
        validColumns.has(c)
    );
    const table = _.get(typeSchema, 'table', type);

    const sqlMap = qb.append(
        qb.merge(
            qb.insertInto(`${group}.${table}`),
            qb.columns(columns),
            qb.values(
                records.map((r) => recordValues(r, columns, columnsConfig))
            ),
            qb.returning(['key'])
        ),
        dependentTypes == null
            ? {}
            : qb.merge(
                  qb.columns([typeKey]),
                  qb.values(dependentTypes.map((v) => [qb.val.inlineParam(v)]))
              )
    );

    const relationsByCol = _.mapKeys(typeSchema.relations, function (
        rel,
        name
    ) {
        switch (rel.type) {
            case 'manyToMany':
                return name + 'Keys';
            case 'manyToOne':
                return name + 'Key';
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    });
    const validRelationCols = _.keys(relationsByCol);
    const relationQueryMaps = _.reduce(
        validRelationCols,
        function (acc, relCol) {
            const rel = relationsByCol[relCol];
            const values = _.filter(
                _.flatMap(records, function (record) {
                    const relKey = ensureArray(record.data[relCol]);
                    if (relKey == null) {
                        return;
                    }

                    switch (rel.type) {
                        case 'manyToMany':
                        case 'manyToOne':
                            if (relKey.length === 0) {
                                return;
                            }

                            return _.map(relKey, (rk) => [
                                qb.val.inlineParam(record.key),
                                qb.val.inlineParam(rk),
                            ]);
                    }

                    throw new Error(`Unspported relation type: ${rel.type}`);
                }),
                (v) => v != null
            );

            if (values.length === 0) {
                return acc;
            }

            acc.push(
                qb.merge(
                    qb.insertInto(rel.relationTable),
                    qb.columns([rel.ownKey, rel.inverseKey]),
                    qb.values(values)
                )
            );

            return acc;
        },
        []
    );

    return client.transactional(async (client) => {
        const res = await client
            .query(qb.toSql(sqlMap))
            .then((res) => res.rows.map((r) => r.key));

        await Promise.all(
            _.map(relationQueryMaps, (sqlMap) => client.query(qb.toSql(sqlMap)))
        );

        return res;
    });
}

function updateExprs(recordData, columnsConfig) {
    return Object.entries(recordData).map(([col, value]) => {
        return qb.expr.eq(col, columnsConfig[col].modifyExpr({value}));
    });
}

function updateRecord({plan, group, type, client}, record, dependentType) {
    const typeSchema = plan[group][type];
    const columnsConfig = typeSchema.columns;
    const validColumns = new Set(Object.keys(columnsConfig));
    const columns = _.keys(record.data).filter((c) => validColumns.has(c));
    const table = _.get(typeSchema, 'table', type);
    const typeKey = _.get(typeSchema, ['type', 'key']);

    const data = _.pick(record.data, columns);
    if (_.isEmpty(data)) {
        return Promise.resolve();
    }

    const sqlMap = qb.append(
        qb.merge(
            qb.update(`${group}.${table}`, 'r'),
            qb.set(updateExprs(data, columnsConfig)),
            qb.where(qb.expr.eq('r.key', qb.val.inlineParam(record.key)))
        ),
        typeKey == null
            ? {}
            : qb.merge(
                  qb.set([
                      qb.expr.eq(typeKey, qb.val.inlineParam(dependentType)),
                  ])
              )
    );

    return client.query(qb.toSql(sqlMap));
}

function quoteIdentifier(name) {
    return name
        .split('.')
        .map((v) => '"' + v + '"')
        .join('.');
}

function ensureArray(v) {
    if (v == null || _.isArray(v)) {
        return v;
    }

    return [v];
}

async function updateRecordRelation({plan, group, type, client}, record) {
    const relationsByCol = _.mapKeys(plan[group][type].relations, function (
        rel,
        name
    ) {
        switch (rel.type) {
            case 'manyToMany':
                return name + 'Keys';
            case 'manyToOne':
                return name + 'Key';
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    });
    const validRelationCols = _.keys(relationsByCol);
    const relationQueries = _.reduce(
        validRelationCols,
        function (acc, relCol) {
            if (!record.data.hasOwnProperty(relCol)) {
                return acc;
            }

            const rel = relationsByCol[relCol];
            const relKey = ensureArray(record.data[relCol]);

            switch (rel.type) {
                case 'manyToMany':
                case 'manyToOne':
                    if (relKey == null || relKey.length === 0) {
                        acc.push(
                            SQL`DELETE FROM `
                                .append(
                                    `${quoteIdentifier(
                                        rel.relationTable
                                    )} WHERE "${rel.ownKey}" = `
                                )
                                .append(SQL`${record.key}`)
                        );

                        return acc;
                    }

                    acc.push(
                        SQL`DELETE FROM `
                            .append(
                                `${quoteIdentifier(rel.relationTable)} WHERE "${
                                    rel.ownKey
                                }" = `
                            )
                            .append(SQL`${record.key} AND NOT (`)
                            .append(`"${rel.inverseKey}"`)
                            .append(SQL` = ANY(${relKey}))`)
                    );

                    const values = _.map(relKey, (rk) => {
                        return [
                            qb.val.inlineParam(record.key),
                            qb.val.inlineParam(rk),
                        ];
                    });

                    acc.push(
                        qb.toSql(
                            qb.merge(
                                qb.insertInto(rel.relationTable),
                                qb.columns([rel.ownKey, rel.inverseKey]),
                                qb.values(values),
                                qb.onConflict([rel.ownKey, rel.inverseKey]),
                                qb.doNothing()
                            )
                        )
                    );

                    return acc;
            }

            throw new Error(`Unspported relation type: ${rel.type}`);
        },
        []
    );

    await Promise.all(_.map(relationQueries, (sql) => client.query(sql)));
}

function updateType({plan, group, type, client}, record) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null) {
        return Promise.resolve(null);
    }

    const dispatchColumn = typeSchema.type.dispatchColumn;
    const dispatchValue = record.data[dispatchColumn];
    const prevDispatchValue = record.type[dispatchColumn];

    if (dispatchValue === prevDispatchValue) {
        return updateDependentType({plan, group, type, client}, record);
    }

    return Promise.all([
        deleteDependentType({plan, group, type, client}, record),
        createDependentType({plan, group, type, client}, record),
    ]).then(([r1, r2]) => r2);
}

async function update({plan, group, type, client}, records) {
    return client.transactional(async (client) => {
        const dependentTypes = await Promise.all(
            records.map((r) => updateType({plan, group, type, client}, r))
        );

        await Promise.all(
            records.map((r, i) =>
                updateRecord({plan, group, type, client}, r, dependentTypes[i])
            )
        );

        await Promise.all(
            records.map((r) =>
                updateRecordRelation({plan, group, type, client}, r)
            )
        );
    });
}

async function deleteRecords({plan, group, type, client}, records) {
    const typeSchema = plan[group][type];
    const table = _.get(typeSchema, 'table', type);
    const keys = records.map((r) => r.key);
    if (keys.length === 0) {
        return;
    }

    if (typeSchema.type != null) {
        const typeInfo = await typeColumns({plan, group, type}, records);
        const dispatchColumn = typeSchema.type.dispatchColumn;
        const relationKey = typeSchema.type.key;

        const byDispatch = _fp.groupBy(
            (r) => _fp.get(dispatchColumn, r),
            typeInfo
        );
        delete byDispatch[null];

        await Promise.all(
            _.map(byDispatch, (info, table) => {
                const keys = info.map((r) => r[relationKey]);
                if (keys.length === 0) {
                    return;
                }

                return client.query(
                    `DELETE FROM "${group}"."${table}" WHERE "key" = ANY($1)`,
                    [keys]
                );
            })
        );
    }

    await client.query(
        `DELETE FROM "${group}"."${table}" WHERE "key" = ANY($1)`,
        [keys]
    );
}

function typeColumns({plan, group, type}, records) {
    const typeSchema = plan[group][type];
    const table = _.get(typeSchema, 'table', type);
    const keys = _.map(records, (r) => r.key);
    if (keys.length === 0) {
        return Promise.resolve();
    }

    const dispatchColummn = typeSchema.type.dispatchColumn;
    const relationKey = typeSchema.type.key;

    const sqlMap = qb.merge(
        qb.select([
            't.key',
            `t.${relationKey}`,
            typeSchema.columns[dispatchColummn].selectExpr({alias: 't'}),
        ]),
        qb.from(`${group}.${table}`, 't'),
        qb.where(qb.expr.in('t.key', _.map(keys, qb.val.inlineParam)))
    );

    return db.query(qb.toSql(sqlMap)).then((res) => res.rows);
}

module.exports = {
    typeColumns,
    list,
    create,
    update,
    deleteRecords,
    lastChange,
};
