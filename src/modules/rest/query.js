const db = require('../../db');
const qb = require('@imatic/pgqb');
const _ = require('lodash');
const _fp = require('lodash/fp');
const {SQL} = require('sql-template-strings');
const {Client} = require('pg');
const _getPlan = require('../../applications/plan').get;
const util = require('./util');
const permission = require('../../permission');

/**
 * @typedef {Object} Filter
 * @property {string} column
 * @property {any} value
 * @property {string} operato
 */

const GUEST_KEY = 'cad8ea0d-f95e-43c1-b162-0704bfc1d3f6';

/**
 * @callback FilterToExpr
 * @param {Filter} filter
 * @returns {import('@imatic/pgqb').Expr}
 *
 * @type {Object<string, FilterToExpr>}
 */
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

/**
 * Returns passed client if given, default one otherwise.
 *
 * @param {import('../../db').Client=} client
 *
 * @returns {import('../../db').Client}
 */
function getDb(client) {
    return client || db;
}

/**
 * Returns passed plan if given, default one otherwise.
 *
 * @param {import('./compiler').Plan=} plan
 *
 * @returns {import('./compiler').Plan}
 */
function getPlan(plan) {
    return plan || _getPlan();
}

/**
 * Converts request filters to internal structure that is easier to work with.
 *
 * @param requestFilter {Object<string, any>}
 * @param columnToAliases {Object<string, string[]>}
 *
 * @returns {Filter[]}
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

/**
 * Converts `filters` into sql map.
 *
 * @param {Filter[]} filters
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
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

/**
 * Converts `requestSort` into sql map.
 *
 * @param {[string, 'ascending'|'descending'][]} requestSort
 * @param {string} alias
 *
 * @return {import('@imatic/pgqb').Sql}
 */
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

/**
 * Converts `page` into sql map.
 *
 * @param {{limit: number, offset: number}=} page
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function pageToQuery(page) {
    if (page == null) {
        return {};
    }

    return qb.merge(qb.limit(page.limit), qb.offset(page.offset));
}

/**
 * Creates part of query related to `type` relations.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
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

/**
 * Creates limiting query based on list permissions for `type` of `user`.
 *
 * @param {{user: {realKey: string}, group: string, type: string}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listPermissionQuery({user, group, type}, alias) {
    if (user == null) {
        return {};
    }

    return qb.merge(
        qb.joins(
            qb.join(
                'user.v_userPermissions',
                'tp',
                qb.expr.and(
                    qb.expr.eq('tp.resourceGroup', qb.val.inlineParam(group)),
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

/**
 * Creates limiting query based on list permissions for relations of `type` of `user`.
 *
 * @param {{user: {realKey: string}, group: string, type: string, plan: import('./compiler').Plan}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listPermissionRelationQuery({user, plan, group, type}, alias) {
    const restrictedColumns = util.restrictedColumns(plan, group, type);
    if (user == null || _.isEmpty(restrictedColumns)) {
        return {};
    }

    return qb.append(
        ..._.map(restrictedColumns, (col, name) => {
            const joinAlias = 'tp_' + name;

            return qb.merge(
                qb.joins(
                    qb.leftJoin(
                        'user.v_userPermissions',
                        joinAlias,
                        qb.expr.and(
                            qb.expr.eq(
                                `${joinAlias}.resourceGroup`,
                                qb.val.inlineParam(col.relation.resourceGroup)
                            ),
                            qb.expr.eq(
                                `${joinAlias}.resourceType`,
                                qb.val.inlineParam(col.relation.resourceType)
                            ),
                            qb.expr.eq(
                                `${joinAlias}.permission`,
                                qb.val.inlineParam('view')
                            ),
                            qb.expr.or(
                                qb.expr.null(`${joinAlias}.resourceKey`),
                                qb.expr.eq(
                                    `${joinAlias}.resourceKey`,
                                    qb.val.raw(`"${alias}"."${name}"::text`)
                                )
                            )
                        )
                    )
                ),
                qb.where(
                    qb.expr.or(
                        qb.expr.and(
                            qb.expr.notNull(`${joinAlias}.userKey`),
                            qb.expr.eq(
                                `${joinAlias}.userKey`,
                                qb.val.inlineParam(user.realKey)
                            )
                        ),
                        qb.expr.null(`${alias}.${name}`)
                    )
                )
            );
        })
    );
}

/**
 * Selects user permissions for given type (these will be returned in http response).
 *
 * @param {string} userKey
 * @param {import('./compiler').Plan} plan
 * @param {string} group
 * @param {string} type
 * @param {string} alias Type table alias
 * @param {string} permissionsAlias Alias under which to put result
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function specificUserPermissionsQuery(
    userKey,
    plan,
    group,
    type,
    alias,
    permissionsAlias
) {
    const joinAlias = 'rela_' + permissionsAlias;
    const restrictedColumns = util.restrictedColumns(plan, group, type);
    const restrictedColumnAlias = (name) => joinAlias + name;

    const restrictedColumnSqlMaps = _.map(restrictedColumns, function (
        col,
        name
    ) {
        const restrictedAlias = restrictedColumnAlias(name);
        const joinAlias = restrictedColumnAlias(name);

        return qb.select([
            qb.expr.as(
                qb.merge(
                    qb.select([
                        qb.val.raw(
                            `ARRAY_AGG(DISTINCT "${restrictedAlias}"."permission")`
                        ),
                    ]),
                    qb.from('user.v_userPermissions', joinAlias),
                    qb.where(
                        qb.expr.and(
                            qb.expr.eq(
                                `${joinAlias}.resourceGroup`,
                                qb.val.inlineParam(col.relation.resourceGroup)
                            ),
                            qb.expr.eq(
                                `${joinAlias}.resourceType`,
                                qb.val.inlineParam(col.relation.resourceType)
                            ),
                            qb.expr.or(
                                qb.expr.null(`${joinAlias}.resourceKey`),
                                qb.expr.eq(
                                    `${joinAlias}.resourceKey`,
                                    qb.val.raw(`"${alias}"."${name}"::text`)
                                )
                            )
                        )
                    )
                ),
                permissionsAlias + '__' + name
            ),
        ]);
    });

    const sqlMap = qb.select([
        qb.expr.as(
            qb.merge(
                qb.select([
                    qb.val.raw(
                        `ARRAY_AGG(DISTINCT "${joinAlias}"."permission")`
                    ),
                ]),
                qb.from('user.v_userPermissions', joinAlias),
                qb.where(
                    qb.expr.and(
                        qb.expr.eq(
                            `${joinAlias}.resourceGroup`,
                            qb.val.inlineParam(group)
                        ),
                        qb.expr.eq(
                            `${joinAlias}.resourceType`,
                            qb.val.inlineParam(type)
                        ),
                        qb.expr.or(
                            qb.expr.null(`${joinAlias}.resourceKey`),
                            qb.expr.eq(
                                `${joinAlias}.resourceKey`,
                                qb.val.raw(`"${alias}"."key"::text`)
                            )
                        ),
                        qb.expr.eq(
                            `${joinAlias}.userKey`,
                            qb.val.inlineParam(userKey)
                        )
                    )
                )
            ),
            permissionsAlias
        ),
    ]);

    return qb.append(sqlMap, ...restrictedColumnSqlMaps);
}

/**
 * Selects user and guest permissions for given type (these will be returned in http response).
 *
 * @param {{user: {realKey: string}, group: string, type: string}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listUserPermissionsQuery({user, plan, group, type}, alias) {
    if (user == null) {
        return {};
    }

    return qb.append(
        specificUserPermissionsQuery(
            user.realKey,
            plan,
            group,
            type,
            alias,
            'active_user_p'
        ),
        specificUserPermissionsQuery(
            GUEST_KEY,
            plan,
            group,
            type,
            alias,
            'guest_user_p'
        )
    );
}

/**
 * Returns datetime of `type`'s last change.
 *
 * @param {{group: string, type: string}} context
 *
 * @returns {Promise<string>}
 */
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

/**
 * Returns deterministic dependent table alias.
 *
 * @param {string} table
 *
 * @returns {string}
 */
function listDependentTypeAlias(table) {
    return '_t_' + table;
}

/**
 * Creates part of query related to specific type of `type`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
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

/**
 * Cleans rows so that they don't contain properties from different types of `type`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {object[]} rows
 *
 * @return {object[]}
 */
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

/**
 * Returns list data.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client?: import('../../db').Client, user: object}} context
 * @param {{sort: [string, 'ascending'|'descending'][], filter: Object<string, any>, page?: {limit: number, offset: number}}} params
 *
 * @returns {Promise<{rows: object[], count: number}>}
 */
function list({plan, group, type, client, user}, {sort, filter, page}) {
    plan = getPlan(plan);
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
        listPermissionQuery({user, group, type}, 't'),
        listPermissionRelationQuery({user, plan, group, type}, 't'),
        listUserPermissionsQuery({user, plan, group, type}, 't'),
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

/**
 * Converts `record` into set exprs intended to be passed into query builder.
 *
 * @param {object} record
 * @param {string[]} columns
 * @param {Object<string, import('./compiler').Column>} columnsConfig
 *
 * @returns {import('@imatic/pgqb').Expr[]}
 */
function recordValues(record, columns, columnsConfig) {
    const data = {...record.data, ...{key: record.key}};

    return columns.map((c) => columnsConfig[c].modifyExpr({value: data[c]}));
}

/**
 * Inserts type dependent data of `record`
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 *
 * @returns {string} Id of created record
 */
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

/**
 * Updates type dependent data of `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 *
 * @returns {string} Id of updated record
 */
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

/**
 * Deletes type dependent data of `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 */
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

/**
 * Creates `records`
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: Client}} context
 *
 * @returns {string[]} Created ids
 */
async function create({plan, group, type, client}, records) {
    plan = getPlan(plan);
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

/**
 ** Converts `recordData` into set exprs intended to be passed into query builder.

 * @param {object} recordData
 * @param {Object<string, import('./compiler').Column>} columnsConfig
 *
 * @returns {import('@imatic/pgqb').Expr[]}
 */
function updateExprs(recordData, columnsConfig) {
    return Object.entries(recordData).map(([col, value]) => {
        return qb.expr.eq(col, columnsConfig[col].modifyExpr({value}));
    });
}

/**
 * Updates `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 * @param {string} dependentType
 */
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

/**
 * Quotes sql identifier.
 *
 * @param {string} name
 *
 * @returns {string}
 */
function quoteIdentifier(name) {
    return name
        .split('.')
        .map((v) => '"' + v + '"')
        .join('.');
}

/**
 * @param {*} v
 *
 * @returns {array}
 */
function ensureArray(v) {
    if (v == null || _.isArray(v)) {
        return v;
    }

    return [v];
}

/**
 * Updates relationships with `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 */
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

/**
 * Updates type dependent data of `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 */
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

/**
 * Updates `records`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object[]} records
 */
async function update({plan, group, type, client}, records) {
    plan = getPlan(plan);
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

/**
 * Deletes `records`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object[]} records
 */
async function deleteRecords({plan, group, type, client}, records) {
    plan = getPlan(plan);
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

/**
 * Retrieves type columns of `records`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {object[]} records
 *
 * @returns {Promise<object[]>}
 */
function typeColumns({plan, group, type}, records) {
    plan = getPlan(plan);
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
