const db = require('../../db');
const qb = require('@imatic/pgqb');
const _ = require('lodash/fp');
const {SQL} = require('sql-template-strings');
const _getPlan = require('../../applications/plan').get;
const util = require('./util');
const translation = require('./translation');
const cf = require('./custom-fields');

const mapWithKey = _.map.convert({cap: false});
const forEachWithKey = _.forEach.convert({cap: false});
const mapKeysWithKey = _.mapKeys.convert({cap: false});
const fill = (value, array) => _.fill(0, array.length, value, array);

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
        const exprs = [];

        const nonNullValues = filter.value.filter((v) => v != null);
        if (nonNullValues.length > 0) {
            exprs.push(
                qb.expr.in(
                    filter.column,
                    nonNullValues.map((v) => qb.val.inlineParam(v))
                )
            );
        }

        if (nonNullValues.length !== filter.value.length) {
            exprs.push(qb.expr.null(filter.column));
        }

        return qb.expr.or(...exprs);
    },
    notin: function (filter) {
        const exprs = [];

        const nonNullValues = filter.value.filter((v) => v != null);
        if (nonNullValues.length > 0) {
            exprs.push(
                qb.expr.notIn(
                    filter.column,
                    nonNullValues.map((v) => qb.val.inlineParam(v))
                )
            );
        }

        if (nonNullValues.length !== filter.value.length) {
            exprs.push(qb.expr.notNull(filter.column));
        }

        return qb.expr.and(...exprs);
    },
    eq: function (filter) {
        if (filter.value === null) {
            return qb.expr.null(filter.column);
        }

        return qb.expr.eq(filter.column, qb.val.inlineParam(filter.value));
    },
    overlaps: function (filter) {
        if (filter.value === null) {
            return qb.expr.null(filter.column);
        }

        return qb.expr.overlaps(
            filter.column,
            qb.val.inlineParam(filter.value)
        );
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
 * @param columnToField {Object<string, string>}
 * @param {Object<string, import('./compiler').Column>} columnsConfig
 *
 * @returns {Filter[]}
 */
function createFilters(
    {plan, group, type, translations, customFields},
    requestFilter,
    columnToAliases,
    columnToField,
    columnsConfig
) {
    const filters = [];
    forEachWithKey((filterData, field) => {
        filters.push(
            _.map((alias) => {
                const createFilter = _.getOr(
                    ({value, operator}) => {
                        const aliasField = columnToField[field] || field;
                        const column =
                            translation.filterFieldExpr(
                                {plan, group, type, translations, customFields},
                                {alias, field: aliasField}
                            ) ||
                            cf.fieldExpr(
                                {customFields},
                                {alias, field: aliasField}
                            ) ||
                            `${alias}.${aliasField}`;

                        return {
                            column: column,
                            value: value,
                            operator: operator,
                        };
                    },
                    [field, 'filter'],
                    columnsConfig
                );

                if (_.isObject(filterData)) {
                    const type = Object.keys(filterData)[0];

                    return createFilter({
                        alias,
                        value: filterData[type],
                        operator: type,
                    });
                }

                return createFilter({
                    alias,
                    value: filterData,
                    operator: 'eq',
                });
            }, columnToAliases[field])
        );
    }, requestFilter);

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

            const exprs = _.map((filter) => {
                const createExpr = filterOperatorToSqlExpr[filter.operator];
                if (createExpr) {
                    return createExpr(filter);
                }
            }, filters).filter((f) => f != null);

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
 * @param {{group: string, type: string, translations: string[]}} context
 * @param {[string, 'ascending'|'descending'][]} requestSort
 * @param {string} alias
 *
 * @return {import('@imatic/pgqb').Sql}
 */
function sortToSqlExpr(
    {plan, group, type, translations, customFields},
    requestSort,
    alias
) {
    if (requestSort == null) {
        return {};
    }

    const exprs = requestSort.map(([field, order]) => {
        const tSortExpr = translation.sortExpr(
            {plan, group, type, translations, customFields},
            {alias, field, order}
        );
        if (tSortExpr != null) {
            return tSortExpr;
        }

        const cfSortExpr = cf.sortExpr({customFields}, {alias, field, order});
        if (cfSortExpr != null) {
            return cfSortExpr;
        }

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
 * Returns deterministic relation table alias.
 *
 * @param {string} name
 *
 * @returns {string}
 */
function listRelationAlias(name) {
    return 'rel_' + name;
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

    const queries = mapWithKey((rel, name) => {
        switch (rel.type) {
            case 'manyToMany': {
                const relAlias = listRelationAlias(name);
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
                const relAlias = listRelationAlias(name);
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
    }, relations);

    if (queries.length === 0) {
        return {};
    }

    return qb.append(...queries);
}

/**
 * Creates limiting query based on list permissions for `type` of `user`.
 *
 * @param {{user: {realKey: string, hash: string}, group: string, type: string}} context
 * @param {string} alias Type table alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listPermissionQuery({user, group, type}, alias) {
    if (user == null) {
        return {};
    }

    const userQuery = qb.merge(
        qb.joins(
            qb.leftJoin(
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
        )
    );
    const userCondition = qb.expr.eq(
        'tp.userKey',
        qb.val.inlineParam(user.realKey)
    );

    if (user.hash == null) {
        return qb.merge(userQuery, qb.where(userCondition));
    }

    const hashQuery = qb.merge(
        qb.joins(
            qb.leftJoin(
                'user.v_hashPermissions',
                'tph',
                qb.expr.and(
                    qb.expr.eq('tph.resourceGroup', qb.val.inlineParam(group)),
                    qb.expr.eq('tph.resourceType', qb.val.inlineParam(type)),
                    qb.expr.eq('tph.permission', qb.val.inlineParam('view')),
                    qb.expr.or(
                        qb.expr.null('tph.resourceKey'),
                        qb.expr.eq(
                            'tph.resourceKey',
                            qb.val.raw(`"${alias}"."key"::text`)
                        )
                    )
                )
            )
        )
    );
    const hashCondition = qb.expr.eq(
        'tph.hashKey',
        qb.val.inlineParam(user.hash)
    );

    return qb.append(
        userQuery,
        hashQuery,
        qb.where(qb.expr.or(userCondition, hashCondition))
    );
}

/**
 * Creates limiting query based on list permissions for relations of `type` of `user`.
 *
 * @param {{user: {realKey: string, hash: string}, group: string, type: string, plan: import('./compiler').Plan}} context
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
        ...mapWithKey((col, name) => {
            const joinAlias = 'tp_' + name;
            const userQuery = qb.merge(
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
                )
            );
            const userCondition = qb.expr.or(
                qb.expr.and(
                    qb.expr.notNull(`${joinAlias}.userKey`),
                    qb.expr.eq(
                        `${joinAlias}.userKey`,
                        qb.val.inlineParam(user.realKey)
                    )
                ),
                qb.expr.null(`${alias}.${name}`)
            );

            if (user.hash == null) {
                return qb.merge(userQuery, qb.where(userCondition));
            }

            const hashJoinAlias = 'tph_' + name;
            const hashQuery = qb.merge(
                qb.joins(
                    qb.leftJoin(
                        'user.v_hashPermissions',
                        hashJoinAlias,
                        qb.expr.and(
                            qb.expr.eq(
                                `${hashJoinAlias}.resourceGroup`,
                                qb.val.inlineParam(col.relation.resourceGroup)
                            ),
                            qb.expr.eq(
                                `${hashJoinAlias}.resourceType`,
                                qb.val.inlineParam(col.relation.resourceType)
                            ),
                            qb.expr.eq(
                                `${hashJoinAlias}.permission`,
                                qb.val.inlineParam('view')
                            ),
                            qb.expr.or(
                                qb.expr.null(`${hashJoinAlias}.resourceKey`),
                                qb.expr.eq(
                                    `${hashJoinAlias}.resourceKey`,
                                    qb.val.raw(`"${alias}"."${name}"::text`)
                                )
                            )
                        )
                    )
                )
            );
            const hashCondition = qb.expr.or(
                qb.expr.and(
                    qb.expr.notNull(`${hashJoinAlias}.hashKey`),
                    qb.expr.eq(
                        `${hashJoinAlias}.hashKey`,
                        qb.val.inlineParam(user.hash)
                    )
                ),
                qb.expr.null(`${alias}.${name}`)
            );

            return qb.append(
                userQuery,
                hashQuery,
                qb.where(qb.expr.or(userCondition, hashCondition))
            );
        }, restrictedColumns)
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

    const restrictedColumnSqlMaps = mapWithKey(function (col, name) {
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
    }, restrictedColumns);

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
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 *
 * @returns {{schema: string, table: string, ownKey: string}[]}
 */
function relationData({plan, group, type}) {
    const typeSchema = plan[group][type];

    return _.flow(
        _.map((rel) => {
            const [schema, table] = rel.relationTable.split('.');

            return {
                schema,
                table,
                ownKey: rel.ownKey,
            };
        }),
        _.uniqBy((m) => m.schema + m.table + m.ownKey)
    )(typeSchema.relations);
}

/**
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {string[]} ids
 *
 * @returns {import('@imatic/pgqb').Expr[]}
 */
function lastChangeRelationsExprs({plan, group, type}, ids) {
    return _.map(
        (rd) =>
            qb.expr.and(
                qb.expr.eq('a.schema_name', qb.val.inlineParam(rd.schema)),
                qb.expr.eq('a.table_name', qb.val.inlineParam(rd.table)),
                qb.expr.in(
                    qb.val.raw(
                        `"a"."row_data" OPERATOR("public".->) '${rd.ownKey}'`
                    ),
                    ids.map(qb.val.inlineParam)
                )
            ),
        relationData({plan, group, type})
    );
}

/**
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {string[]} ids
 *
 * @returns {import('@imatic/pgqb').Expr[]}
 */
function lastChangeDependentTypesExprs({plan, group, type}, ids) {
    const typeSchema = plan[group][type];
    const typeKey = _.get(['type', 'key'], typeSchema);

    return mapWithKey(
        (type, typeTable) =>
            qb.expr.and(
                qb.expr.eq('a.schema_name', qb.val.inlineParam(group)),
                qb.expr.eq('a.table_name', qb.val.inlineParam(typeTable)),
                qb.expr.in(
                    qb.val.raw(`"a"."row_data" OPERATOR("public".->) 'key'`),
                    qb.merge(
                        qb.select([qb.val.raw(`"_t"."${typeKey}"::text`)]),
                        qb.from(`${group}.${typeSchema.table}`, '_t'),
                        qb.where(
                            qb.expr.in('_t.key', ids.map(qb.val.inlineParam))
                        )
                    )
                )
            ),
        _.get(['type', 'types'], typeSchema)
    );
}

/**
 * Returns datetime of `type`'s last change for `ids` (does not take into account truncates).
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string}} context
 * @param {string[]} ids
 *
 * @returns {Promise<string|null>}
 */
async function lastChange({plan, group, type}, ids) {
    if (ids.length === 0) {
        return Promise.resolve(null);
    }

    const sqlMap = qb.merge(
        qb.select([qb.expr.as('a.action_tstamp_stm', 'change')]),
        qb.from('audit.logged_actions', 'a'),
        qb.where(
            qb.expr.or(
                qb.expr.and(
                    qb.expr.eq('a.schema_name', qb.val.inlineParam(group)),
                    qb.expr.eq(
                        'a.table_name',
                        qb.val.inlineParam(plan[group][type].table)
                    ),
                    qb.expr.in(
                        qb.val.raw(
                            `"a"."row_data" OPERATOR("public".->) 'key'`
                        ),
                        ids.map(qb.val.inlineParam)
                    )
                ),
                ...translation.lastChangeExprs({group, type}, ids),
                ...lastChangeRelationsExprs({plan, group, type}, ids),
                ...lastChangeDependentTypesExprs({plan, group, type}, ids)
            )
        ),
        qb.orderBy('a.action_tstamp_stm', 'DESC'),
        qb.limit(1)
    );

    const res = await db.query(qb.toSql(sqlMap));

    return _.first(_.map((row) => row.change, res.rows));
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
        ..._.map((table) => {
            const al = listDependentTypeAlias(table);
            const columns = _.getOr(
                {},
                ['type', 'types', table, 'columns'],
                typeSchema
            );

            forEachWithKey((c, name) => {
                selectByColumn[name] = selectByColumn[name] || [];
                selectByColumn[name].push(c.selectExpr({alias: al}));
            }, columns);

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
            mapWithKey((selects, name) => {
                return qb.expr.as(qb.expr.fn('COALESCE', ...selects), name);
            }, selectByColumn)
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

    const allTypeCols = _.uniq(
        _.flatMap((t) => _.keys(t.columns), typeSchema.type.types)
    );

    const omitColByType = _.mapValues(function (type) {
        return _.difference(allTypeCols, _.keys(type.columns));
    }, typeSchema.type.types);
    omitColByType[null] = allTypeCols;

    const dispatchColumn = typeSchema.type.dispatchColumn;

    return _.map((row) => {
        const currentType = row[dispatchColumn];

        return _.omit(omitColByType[currentType], row);
    }, rows);
}

/**
 * @param {{group: string, type: string}} context
 * @param {string} alias
 *
 * @param {import('@imatic/pgqb').Sql}
 */
function createdAtQuery({group, table}, alias) {
    return qb.select([
        qb.expr.as(
            qb.merge(
                qb.select([qb.expr.as('a.action_tstamp_stm', 'createdAt')]),
                qb.from('audit.logged_actions', 'a'),
                qb.where(
                    qb.expr.and(
                        qb.expr.eq('a.schema_name', qb.val.inlineParam(group)),
                        qb.expr.eq('a.table_name', qb.val.inlineParam(table)),
                        qb.expr.eq('a.action', qb.val.inlineParam('I')),
                        qb.expr.eq(
                            qb.val.raw(
                                `"a"."row_data" OPERATOR("public".->) 'key'`
                            ),
                            qb.val.raw(`"${alias}"."key"::text`)
                        )
                    )
                ),
                qb.limit(1)
            ),
            'createdAt'
        ),
    ]);
}

/**
 * @param {{group: string, type: string}} context
 * @param {string} alias
 * @param {import('@imatic/pgqb').Sql} sortExpr
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function createSortQuery({group, table}, alias, sortExpr) {
    if (!_.isEmpty(sortExpr)) {
        return sortExpr;
    }

    return qb.orderBy(createdAtQuery({group, table}, alias));
}

/**
 * @param {{plan: import('./compiler').Plan, group: string, type: string, user: object}} context
 * @param {string} alias
 *
 * @returns {import('@imatic/pgqb').Sql}
 */
function listPermissionsQuery(
    {plan, group, type, user},
    alias
) {
    return qb.append(
        listPermissionQuery({user, group, type}, alias),
        listPermissionRelationQuery({user, plan, group, type}, alias)
    );
}

/**
 * Returns list data.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client?: import('../../db').Client, user: object}} context
 * @param {{sort: [string, 'ascending'|'descending'][], filter: Object<string, any>, page?: {limit: number, offset: number}, updateSqlMap?: (sqlMap: import('@imatic/pgqb').Sql, alias: string) => import('@imatic/pgqb').Sql}} params
 *
 * @returns {{rows: import('@imatic/pgqb').Sql, count: import('@imatic/pgqb').Sql}}
 */
function listQueries(
    {plan, group, type, client, user, customFields},
    {sort, filter, page, translations, updateSqlMap}
) {
    updateSqlMap = updateSqlMap || _.identity;
    const typeSchema = plan[group][type];
    const columns = typeSchema.context.list.columns;
    const table = _.getOr(type, 'table', typeSchema);
    const customColumnsConfig = cf.filterColumnsConfig(customFields);
    const columnsConfig = _.merge(
        plan[group][type].columns,
        customColumnsConfig
    );

    const columnToAliases = _.reduce(
        function (res, next) {
            return _.mergeWith(
                function (x, y) {
                    if (x === undefined) {
                        return y;
                    }

                    return _.concat(x, y);
                },
                res,
                next
            );
        },
        {},
        [
            _.zipObject(columns, fill(['t'], new Array(columns.length))),
            _.zipObject(
                _.keys(customColumnsConfig),
                fill(['t'], new Array(_.size(customColumnsConfig)))
            ),
            ...mapWithKey((t, name) => {
                const columns = _.getOr([], ['context', 'list', 'columns'], t);

                return _.zipObject(
                    columns,
                    fill(
                        [listDependentTypeAlias(name)],
                        new Array(columns.length)
                    )
                );
            }, _.getOr({}, ['type', 'types'], typeSchema)),
            ...mapWithKey((rel, name) => {
                switch (rel.type) {
                    case 'manyToMany':
                        return {[name + 'Keys']: [listRelationAlias(name)]};
                    case 'manyToOne':
                        return {[name + 'Key']: [listRelationAlias(name)]};
                }

                throw new Error(`Unspported relation type: ${rel.type}`);
            }, plan[group][type].relations),
        ]
    );

    const columnToField = _.reduce(
        (res, name) => {
            const rel = plan[group][type].relations[name];
            switch (rel.type) {
                case 'manyToMany':
                    res[name + 'Keys'] = rel.inverseKey;
                    return res;
                case 'manyToOne':
                    res[name + 'Key'] = rel.inverseKey;
                    return res;
            }

            throw new Error(`Unspported relation type: ${rel.type}`);
        },
        {},
        _.keys(plan[group][type].relations)
    );

    const sqlMap = updateSqlMap(
        qb.append(
            qb.merge(
                qb.select(
                    columns.map((c) => columnsConfig[c].selectExpr({alias: 't'}))
                ),
                qb.from(`${group}.${table}`, 't'),
                qb.groupBy(['t.key'])
            ),
            listUserPermissionsQuery({user, plan, group, type}, 't'),
            listDependentTypeQuery({plan, group, type}, 't'),
            filtersToSqlExpr(
                createFilters(
                    {plan, group, type, translations, customFields},
                    filter,
                    columnToAliases,
                    columnToField,
                    columnsConfig,
                    translations
                )
            ),
            relationsQuery({plan, group, type}, 't'),
            translation.listTranslationsQuery({group, type, translations}, 't'),
            cf.listQuery('t')
        ),
        't'
    );

    const permissionsQuery = listPermissionsQuery({plan, user, group, type}, 't');

    const countSqlMap = qb.merge(
        qb.select([qb.expr.as(qb.expr.fn('COUNT', qb.val.raw(1)), 'count')]),
        qb.from(qb.merge(qb.append(sqlMap, permissionsQuery), qb.select(['t.key'])), '_gt')
    );

    const sortQuery = createSortQuery(
        {group, table},
        't',
        sortToSqlExpr(
            {plan, group, type, translations, customFields},
            sort,
            't'
        )
    );

    const keysSqlMap = qb.append(
        qb.merge(
            sqlMap,
            qb.select(['t.key']),
            sortQuery
        ),
        permissionsQuery
    );

    const resultSqlMap = qb.merge(
        sqlMap,
        qb.where(qb.expr.in('t.key', keysSqlMap)),
        sortQuery,
        pageToQuery(page)
    );

    return {
        rows: resultSqlMap,
        count: countSqlMap,
    };
}

/**
 * Returns list data.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client?: import('../../db').Client, user: object}} context
 * @param {{sort: [string, 'ascending'|'descending'][], filter: Object<string, any>, page?: {limit: number, offset: number}, updateSqlMap?: (sqlMap: import('@imatic/pgqb').Sql, alias: string) => import('@imatic/pgqb').Sql}} params
 *
 * @returns {Promise<object[]>}}
 */
 async function listRows(
    {plan, group, type, client, user, customFields},
    {sort, filter, page, translations, updateSqlMap}
) {
    plan = getPlan(plan);
    const queries = listQueries(
        {plan, group, type, client, user, customFields},
        {sort, filter, page, translations, updateSqlMap}
    );

    const db = getDb(client);

    const rows = await db.query(qb.toSql(queries.rows)).then((res) => res.rows);

    return cleanDependentTypeCols({plan, group, type}, rows);
}

/**
 * Returns list data.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client?: import('../../db').Client, user: object}} context
 * @param {{sort: [string, 'ascending'|'descending'][], filter: Object<string, any>, page?: {limit: number, offset: number}, updateSqlMap?: (sqlMap: import('@imatic/pgqb').Sql, alias: string) => import('@imatic/pgqb').Sql}} params
 *
 * @returns {Promise<{rows: object[], count: number}>}
 */
function list(
    {plan, group, type, client, user, customFields},
    {sort, filter, page, translations, updateSqlMap}
) {
    plan = getPlan(plan);
    const queries = listQueries(
        {plan, group, type, client, user, customFields},
        {sort, filter, page, translations, updateSqlMap}
    );

    const db = getDb(client);

    return Promise.all([
        db.query(qb.toSql(queries.rows)).then((res) => res.rows),
        db
            .query(qb.toSql(queries.count))
            .then((res) => _.getOr(0, 'count', res.rows[0])),
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

    return columns.map((c) =>
        columnsConfig[c].modifyExpr({value: data[c], record: data})
    );
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
    const dispatchValue = _.get(['data', dispatchColumn], record);
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
    const dispatchValue = _.get(['type', dispatchColumn], record);
    if (dispatchValue == null) {
        return Promise.resolve(null);
    }

    const relationKey = typeSchema.type.key;
    const relationKeyValue = _.get(['type', relationKey], record);
    if (relationKeyValue == null) {
        return Promise.resolve(null);
    }

    const columnsConfig = typeSchema.type.types[dispatchValue].columns;
    const validColumns = new Set(Object.keys(columnsConfig));
    const columns = _.keys(record.data).filter((c) => validColumns.has(c));
    const data = _.pick(columns, record.data);

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
    const dispatchValue = _.get(['type', dispatchColumn], record);
    if (dispatchValue == null) {
        return Promise.resolve();
    }

    const relationKey = typeSchema.type.key;
    const relationKeyValue = _.get(['type', relationKey], record);
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
    const typeKey = _.get(['type', 'key'], typeSchema);

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
    const columns = _.concat(
        ['key', ...Object.keys(records[0].data)].filter((c) =>
            validColumns.has(c)
        ),
        _.getOr([], ['context', 'create', 'queryColumns'], typeSchema)
    );
    const table = _.getOr(type, 'table', typeSchema);

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
              ),
        cf.create({plan, group, type}, records)
    );

    const relationsByCol = mapKeysWithKey(function (rel, name) {
        switch (rel.type) {
            case 'manyToMany':
                return name + 'Keys';
            case 'manyToOne':
                return name + 'Key';
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    }, typeSchema.relations);
    const validRelationCols = _.keys(relationsByCol);
    const relationQueryMaps = _.reduce(
        function (acc, relCol) {
            const rel = relationsByCol[relCol];
            const values = _.filter(
                (v) => v != null,
                _.flatMap(function (record) {
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

                            return _.map(
                                (rk) => [
                                    qb.val.inlineParam(record.key),
                                    qb.val.inlineParam(rk),
                                ],
                                relKey
                            );
                    }

                    throw new Error(`Unspported relation type: ${rel.type}`);
                }, records)
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
        [],
        validRelationCols
    );

    return client.transactional(async (client) => {
        const res = await client
            .query(qb.toSql(sqlMap))
            .then((res) => res.rows.map((r) => r.key));

        await Promise.all(
            _.map((sqlMap) => client.query(qb.toSql(sqlMap)), relationQueryMaps)
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
        return qb.expr.eq(
            col,
            columnsConfig[col].modifyExpr({value, record: recordData})
        );
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
    const table = _.getOr(type, 'table', typeSchema);
    const typeKey = _.get(['type', 'key'], typeSchema);

    const data = _.pick(columns, record.data);

    const queryColumns = _.filter(
        (col) =>
            _.some((input) => _.has(input, data), columnsConfig[col].inputs),
        _.getOr([], ['context', 'create', 'queryColumns'], typeSchema)
    );
    const enrichedData = _.merge(
        data,
        _.zipObject(queryColumns, new Array(queryColumns.length))
    );

    const sqlMap = qb.append(
        qb.merge(
            qb.update(`${group}.${table}`, 'r'),
            qb.set(updateExprs(enrichedData, columnsConfig)),
            qb.where(qb.expr.eq('r.key', qb.val.inlineParam(record.key)))
        ),
        typeKey == null
            ? {}
            : qb.merge(
                  qb.set([
                      qb.expr.eq(typeKey, qb.val.inlineParam(dependentType)),
                  ])
              ),
        cf.update({plan, group, type}, record)
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
    const relationsByCol = mapKeysWithKey(function (rel, name) {
        switch (rel.type) {
            case 'manyToMany':
                return name + 'Keys';
            case 'manyToOne':
                return name + 'Key';
        }

        throw new Error(`Unspported relation type: ${rel.type}`);
    }, plan[group][type].relations);
    const validRelationCols = _.keys(relationsByCol);
    const relationQueries = _.reduce(
        function (acc, relCol) {
            if (!record.data.hasOwnProperty(relCol)) {
                return acc;
            }

            const rel = relationsByCol[relCol];
            const relKey = ensureArray(record.data[relCol]);

            switch (rel.type) {
                case 'manyToMany':
                case 'manyToOne': {
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
                            .append(SQL`${record.key} AND (`)
                            .append(`"${rel.inverseKey}"`)
                            .append(SQL` = ANY(${relKey}))`)
                    );

                    // todo find out how to do this using imatic pgqb
                    const parentTableName = plan[group][type].table || type;
                    acc.push(
						SQL`INSERT INTO `
							.append(`${quoteIdentifier(rel.relationTable)} ("${rel.ownKey}", "${rel.inverseKey}") `)
							.append(`SELECT '${record.key}', '${relKey}' WHERE EXISTS `)
							.append(`(SELECT * FROM "${group}"."${parentTableName}" `)
							.append(`WHERE "key" = '${record.key}')`)
                    );

                    return acc;
                }
            }

            throw new Error(`Unspported relation type: ${rel.type}`);
        },
        [],
        validRelationCols
    );
    for (const sql of relationQueries) {
        await client.query(sql);
    }
}

/**
 * Updates type dependent data of `record`.
 *
 * @param {{plan: import('./compiler').Plan, group: string, type: string, client: import('../../db').Client}} context
 * @param {object} record
 */
function updateType({plan, group, type, client}, record) {
    const typeSchema = plan[group][type];
    if (typeSchema.type == null || record.type == null) {
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
    const table = _.getOr(type, 'table', typeSchema);
    const keys = records.map((r) => r.key);
    if (keys.length === 0) {
        return;
    }

    if (typeSchema.type != null) {
        const typeInfo = await typeColumns({plan, group, type}, records);
        const dispatchColumn = typeSchema.type.dispatchColumn;
        const relationKey = typeSchema.type.key;

        const byDispatch = _.groupBy((r) => _.get(dispatchColumn, r), typeInfo);
        delete byDispatch[null];

        await Promise.all(
            mapWithKey((info, table) => {
                const keys = info.map((r) => r[relationKey]);
                if (keys.length === 0) {
                    return;
                }

                return client.query(
                    `DELETE FROM "${group}"."${table}" WHERE "key" = ANY($1)`,
                    [keys]
                );
            }, byDispatch)
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
    const table = _.getOr(type, 'table', typeSchema);
    const keys = _.map((r) => r.key, records);
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
        qb.where(qb.expr.in('t.key', _.map(qb.val.inlineParam, keys)))
    );

    return db.query(qb.toSql(sqlMap)).then((res) => res.rows);
}

module.exports = {
    typeColumns,
    listPermissionsQuery,
    list,
    listRows,
    create,
    update,
    deleteRecords,
    lastChange,
};
