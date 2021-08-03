const Joi = require('../../joi');
const uuid = require('../../uuid');
const config = require('../../../config');
const qb = require('@imatic/pgqb');
const {SQL} = require('sql-template-strings');
const p = require('../../postgres');

module.exports = {
    user: {
        users: {
            context: {
                list: {
                    columns: ['key', 'email', 'name', 'phone'],
                },
                create: {
                    columns: ['key', 'email', 'name', 'phone', 'password'],
                },
                update: {
                    columns: ['key', 'email', 'name', 'phone', 'password'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                email: {
                    defaultValue: null,
                    schema: Joi.string(),
                    index: true
                },
                name: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                phone: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                password: {
                    defaultValue: null,
                    schema: Joi.string(),
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(
                            SQL`CRYPT(${value}, GEN_SALT('bf', ${config.password.iteration_counts}))`
                        );
                    },
                },
            },
            relations: {
                group: {
                    type: 'manyToMany',
                    relationTable: 'user.userGroups',
                    ownKey: 'userKey',
                    inverseKey: 'groupKey',
                    resourceGroup: 'user',
                    resourceType: 'groups',
                },
                permission: {
                    type: 'manyToMany',
                    relationTable: 'user.userPermissions',
                    ownKey: 'userKey',
                    inverseKey: 'permissionKey',
                    resourceGroup: 'user',
                    resourceType: 'permissions',
                },
            },
        },
        groups: {
            context: {
                list: {
                    columns: ['key', 'name'],
                },
                create: {
                    columns: ['key', 'name'],
                },
                update: {
                    columns: ['key', 'name'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                name: {
                    schema: Joi.string(),
                    index: true
                },
            },
        },
        permissions: {
            context: {
                list: {
                    columns: [
                        'key',
                        'resourceKey',
                        'resourceType',
                        'permission',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'resourceKey',
                        'resourceType',
                        'permission',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'resourceKey',
                        'resourceType',
                        'permission',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                resourceKey: {
                    defaultValue: null,
                    schema: Joi.string(),
                },
                resourceType: {
                    defaultValue: null,
                    schema: Joi.string(),
                },
                permission: {
                    defaultValue: null,
                    schema: Joi.string(),
                },
            },
        },
    },
    metadata: {
        scopes: {
            table: 'scope',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'configuration',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'configuration',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'configuration',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                configuration: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.scopeRelation',
                    ownKey: 'parentScopeKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.scopeRelation',
                    ownKey: 'parentScopeKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        places: {
            table: 'place',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'geometry',
                        'bbox',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'geometry',
                        'bbox',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'geometry',
                        'bbox',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                geometry: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                    selectExpr: function ({alias}) {
                        // todo this has to be fixed properly in future
                        return qb.val.raw(SQL`ST_AsGeoJSON(t."geometry")::JSON AS "geometry"`);
                    },
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(SQL`ST_GeomFromGeoJSON(${value})`);
                    },
                },
                bbox: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                    selectExpr: function ({alias}) {
                        // todo this has to be fixed properly in future
                        return qb.val.raw(SQL`ST_AsGeoJSON(t."bbox")::JSON AS "bbox"`);
                    },
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(SQL`ST_GeomFromGeoJSON(${value})`);
                    },
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.placeRelation',
                    ownKey: 'parentPlaceKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.placeRelation',
                    ownKey: 'parentPlaceKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.placeRelation',
                    ownKey: 'parentPlaceKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                }
            },
        },
        periods: {
            table: 'period',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'period',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'period',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'period',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                period: {
                    defaultValue: null,
                    schema: Joi.isoDuration().allow(null),
                    filter: ({alias, value, operator}) => ({
                        column: alias + '.periodRange',
                        value: p.intervalToRange(value),
                        operator,
                    }),
                    index: true
                },
                periodRange: {
                    inputs: ['period'],
                    defaultValue: null,
                    modifyExpr: function ({record}) {
                        return qb.val.inlineParam(
                            p.intervalToRange(record.period)
                        );
                    },
                    index: true
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.periodRelation',
                    ownKey: 'parentPeriodKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.periodRelation',
                    ownKey: 'parentPeriodKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.periodRelation',
                    ownKey: 'parentPeriodKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        attributeSets: {
            table: 'attributeSet',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.attributeSetRelation',
                    ownKey: 'parentAttributeSetKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.attributeSetRelation',
                    ownKey: 'parentAttributeSetKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        attributes: {
            table: 'attribute',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                        'unit',
                        'valueType',
                        'color',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                        'unit',
                        'valueType',
                        'color',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                        'unit',
                        'valueType',
                        'color',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                type: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                unit: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                valueType: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                color: {
                    defaultValue: null,
                    schema: Joi.string().allow(null)
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.attributeRelation',
                    ownKey: 'parentAttributeKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.attributeRelation',
                    ownKey: 'parentAttributeKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        layerTemplates: {
            table: 'layerTemplate',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.layerTemplateRelation',
                    ownKey: 'parentLayerTemplateKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.layerTemplateRelation',
                    ownKey: 'parentLayerTemplateKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.layerTemplateRelation',
                    ownKey: 'parentLayerTemplateKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        scenarios: {
            table: 'scenario',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.scenarioRelation',
                    ownKey: 'parentScenarioKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.scenarioRelation',
                    ownKey: 'parentScenarioKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        cases: {
            table: 'case',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.caseRelation',
                    ownKey: 'parentCaseKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.caseRelation',
                    ownKey: 'parentCaseKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        areaTrees: {
            table: 'areaTree',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.areaTreeRelation',
                    ownKey: 'parentAreaTreeKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.areaTreeRelation',
                    ownKey: 'parentAreaTreeKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.areaTreeRelation',
                    ownKey: 'parentAreaTreeKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        areaTreeLevels: {
            table: 'areaTreeLevel',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'level',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'level',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'level',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                level: {
                    defaultValue: null,
                    schema: Joi.number().integer().allow(null),
                    index: true
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.areaTreeLevelRelation',
                    ownKey: 'parentAreaTreeLevelKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                areaTree: {
                    type: 'manyToOne',
                    relationTable: 'relations.areaTreeLevelRelation',
                    ownKey: 'parentAreaTreeLevelKey',
                    inverseKey: 'areaTreeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'areaTrees',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.areaTreeLevelRelation',
                    ownKey: 'parentAreaTreeLevelKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        tags: {
            table: 'tag',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'color',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'color',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'color',
                    ],
                },
                relations: {
                    application: {
                        type: 'manyToOne',
                        relationTable: 'relations.tagRelation',
                        ownKey: 'parentTagKey',
                        inverseKey: 'applicationKey',
                        resourceGroup: 'application',
                        resourceType: 'applications',
                    },
                    scope: {
                        type: 'manyToOne',
                        relationTable: 'relations.tagRelation',
                        ownKey: 'parentTagKey',
                        inverseKey: 'scopeKey',
                        resourceGroup: 'metadata',
                        resourceType: 'scopes',
                    },
                    tag: {
                        type: 'manyToMany',
                        relationTable: 'relations.tagRelation',
                        ownKey: 'parentTagKey',
                        inverseKey: 'tagKey',
                        resourceGroup: 'metadata',
                        resourceType: 'tags',
                    },
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                color: {
                    defaultValue: null,
                    schema: Joi.string().allow(null)
                },
            },
        },
        styles: {
            table: 'style',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'source',
                        'nameGeoserver',
                        'definition',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'source',
                        'nameGeoserver',
                        'definition',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'source',
                        'nameGeoserver',
                        'definition',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                source: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameGeoserver: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                definition: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.styleRelation',
                    ownKey: 'parentStyleKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.styleRelation',
                    ownKey: 'parentStyleKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
    },
    application: {
        applications: {
            table: 'application',
            context: {
                list: {
                    columns: ['key', 'name', 'description', 'color'],
                },
                create: {
                    columns: ['key', 'name', 'description', 'color'],
                },
                update: {
                    columns: ['key', 'name', 'description', 'color'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string(),
                },
                name: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                color: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
        },
        configurations: {
            table: 'configuration',
            context: {
                list: {
                    columns: ['key', 'data'],
                },
                create: {
                    columns: ['key', 'data'],
                },
                update: {
                    columns: ['key', 'data'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                data: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.configurationRelation',
                    ownKey: 'parentConfigurationKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
            },
        },
        layerTrees: {
            table: 'layerTree',
            context: {
                list: {
                    columns: ['key', 'nameInternal', 'structure'],
                },
                create: {
                    columns: ['key', 'nameInternal', 'structure'],
                },
                update: {
                    columns: ['key', 'nameInternal', 'structure'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string(),
                    index: true
                },
                structure: {
                    defaultValue: null,
                    schema: Joi.object(),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.layerTreeRelation',
                    ownKey: 'parentLayerTreeKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.layerTreeRelation',
                    ownKey: 'parentLayerTreeKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                },
            },
        },
    },
    dataSources: {
        attribute: {
            table: 'attributeDataSource',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameInternal',
                        'attribution',
                        'tableName',
                        'columnName',
                        'fidColumnName'
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameInternal',
                        'attribution',
                        'tableName',
                        'columnName',
                        'fidColumnName'
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameInternal',
                        'attribution',
                        'tableName',
                        'columnName',
                        'fidColumnName'
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                attribution: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                tableName: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                columnName: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                fidColumnName: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
            },
        },
        spatial: {
            table: 'dataSource',
            type: {
                dispatchColumn: 'type',
                key: 'sourceKey',
                types: {
                    "vector": {
                        context: {
                            list: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                            create: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                            update: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                        },
                        columns: {
                            layerName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            tableName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            fidColumnName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            geometryColumnName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                        },
                    },
                    "tiledVector": {
                        context: {
                            list: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                            create: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                            update: {
                                columns: ['layerName', 'tableName', 'fidColumnName', 'geometryColumnName'],
                            },
                        },
                        columns: {
                            layerName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            tableName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            fidColumnName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            geometryColumnName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                        },
                    },
                    raster: {
                        context: {
                            list: {
                                columns: ['layerName', 'tableName'],
                            },
                            create: {
                                columns: ['layerName', 'tableName'],
                            },
                            update: {
                                columns: ['layerName', 'tableName'],
                            },
                        },
                        columns: {
                            layerName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            tableName: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                        },
                    },
                    wms: {
                        context: {
                            list: {
                                columns: [
                                    'url',
                                    'layers',
                                    'styles',
                                    'configuration',
                                ],
                            },
                            create: {
                                columns: [
                                    'url',
                                    'layers',
                                    'styles',
                                    'configuration',
                                ],
                            },
                            update: {
                                columns: [
                                    'url',
                                    'layers',
                                    'styles',
                                    'configuration',
                                ],
                            },
                        },
                        columns: {
                            url: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                                index: true
                            },
                            layers: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                            },
                            styles: {
                                defaultValue: null,
                                schema: Joi.string().allow(null),
                            },
                            configuration: {
                                defaultValue: null,
                                schema: Joi.object().allow(null),
                            },
                        },
                    },
                    wmts: {
                        context: {
                            list: {
                                columns: ['urls'],
                            },
                            create: {
                                columns: ['urls'],
                            },
                            update: {
                                columns: ['urls'],
                            },
                        },
                        columns: {
                            urls: {
                                defaultValue: null,
                                schema: Joi.array().items(Joi.string()).allow(null),
                            },
                        },
                    },
                },
            },
            context: {
                list: {
                    columns: ['key', 'nameInternal', 'attribution', 'type'],
                },
                create: {
                    columns: ['key', 'nameInternal', 'attribution', 'type'],
                },
                update: {
                    columns: ['key', 'nameInternal', 'attribution', 'type'],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                attribution: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                type: {
                    defaultValue: null,
                    schema: Joi.string().valid(
                        null,
                        'raster',
                        'tiledVector',
                        'vector',
                        'wms',
                        'wmts'
                    ),
                    index: true
                },
            },
        },
    },
    relations: {
        spatial: {
            table: 'spatialDataSourceRelation',
            context: {
                list: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'spatialDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'applicationKey',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'spatialDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'applicationKey',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'spatialDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'applicationKey',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                scopeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'scopes',
                    },
                    index: true
                },
                periodKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'periods',
                    },
                    index: true
                },
                placeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'places',
                    },
                    index: true
                },
                spatialDataSourceKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                layerTemplateKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                scenarioKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'scenarios',
                    },
                    index: true
                },
                caseKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                applicationKey: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
            },
        },
        attribute: {
            table: 'attributeDataSourceRelation',
            context: {
                list: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'attributeDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'attributeSetKey',
                        'attributeKey',
                        'areaTreeLevelKey',
                        'applicationKey',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'attributeDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'attributeSetKey',
                        'attributeKey',
                        'areaTreeLevelKey',
                        'applicationKey',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'scopeKey',
                        'periodKey',
                        'placeKey',
                        'attributeDataSourceKey',
                        'layerTemplateKey',
                        'scenarioKey',
                        'caseKey',
                        'attributeSetKey',
                        'attributeKey',
                        'areaTreeLevelKey',
                        'applicationKey',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                scopeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'scopes',
                    },
                    index: true
                },
                periodKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'periods',
                    },
                    index: true
                },
                placeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'places',
                    },
                    index: true
                },
                attributeDataSourceKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                layerTemplateKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                scenarioKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    relation: {
                        resourceGroup: 'metadata',
                        resourceType: 'scenarios',
                    },
                    index: true
                },
                caseKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                attributeSetKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                attributeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                areaTreeLevelKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                    index: true
                },
                applicationKey: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
            },
        },
        area: {
            table: 'areaRelation',
            context: {
                list: {
                    columns: [
                        'key',
                        'areaTreeKey',
                        'areaTreeLevelKey',
                        'fidColumnName',
                        'parentFidColumnName',
                        'spatialDataSourceKey',
                        'scopeKey',
                        'placeKey',
                        'periodKey',
                        'caseKey',
                        'scenarioKey',
                        'applicationKey',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'areaTreeKey',
                        'areaTreeLevelKey',
                        'fidColumnName',
                        'parentFidColumnName',
                        'spatialDataSourceKey',
                        'scopeKey',
                        'placeKey',
                        'periodKey',
                        'caseKey',
                        'scenarioKey',
                        'applicationKey',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'areaTreeKey',
                        'areaTreeLevelKey',
                        'fidColumnName',
                        'parentFidColumnName',
                        'spatialDataSourceKey',
                        'scopeKey',
                        'placeKey',
                        'periodKey',
                        'caseKey',
                        'scenarioKey',
                        'applicationKey',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                areaTreeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                areaTreeLevelKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                fidColumnName: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                parentFidColumnName: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                spatialDataSourceKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                scopeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                placeKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                periodKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                caseKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                scenarioKey: {
                    defaultValue: null,
                    schema: Joi.string().uuid().allow(null),
                },
                applicationKey: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
            },
        },
    },
    views: {
        views: {
            table: 'view',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameInternal',
                        'nameDisplay',
                        'description',
                        'state',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameInternal',
                        'nameDisplay',
                        'description',
                        'state',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameInternal',
                        'nameDisplay',
                        'description',
                        'state',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                state: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                },
            },
            relations: {
                application: {
                    type: 'manyToOne',
                    relationTable: 'relations.viewRelation',
                    ownKey: 'parentViewKey',
                    inverseKey: 'applicationKey',
                    resourceGroup: 'application',
                    resourceType: 'applications',
                },
            },
        },
    },
    specific: {
        esponFuoreIndicators: {
            table: 'esponFuoreIndicator',
            context: {
                list: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'nameDisplay',
                        'nameInternal',
                        'description',
                        'type',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                nameDisplay: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                nameInternal: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                description: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                type: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
            },
            relations: {
                attribute: {
                    type: 'manyToOne',
                    relationTable: 'relations.esponFuoreIndicatorRelation',
                    ownKey: 'parentEsponFuoreIndicatorKey',
                    inverseKey: 'attributeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'attributes',
                },
                view: {
                    type: 'manyToOne',
                    relationTable: 'relations.esponFuoreIndicatorRelation',
                    ownKey: 'parentEsponFuoreIndicatorKey',
                    inverseKey: 'viewKey',
                    resourceGroup: 'views',
                    resourceType: 'views',
                },
                scope: {
                    type: 'manyToOne',
                    relationTable: 'relations.esponFuoreIndicatorRelation',
                    ownKey: 'parentEsponFuoreIndicatorKey',
                    inverseKey: 'scopeKey',
                    resourceGroup: 'metadata',
                    resourceType: 'scopes',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.esponFuoreIndicatorRelation',
                    ownKey: 'parentEsponFuoreIndicatorKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
        lpisChangeCases: {
            table: 'lpisChangeCase',
            context: {
                list: {
                    columns: [
                        'key',
                        'submitDate',
                        'codeDpb',
                        'codeJi',
                        'caseKey',
                        'changeDescription',
                        'changeDescriptionPlace',
                        'changeDescriptionOther',
                        'evaluationResult',
                        'evaluationDescription',
                        'evaluationDescriptionOther',
                        'evaluationUsedSources',
                        'geometryBefore',
                        'geometryAfter',
                        'status',
                    ],
                },
                create: {
                    columns: [
                        'key',
                        'submitDate',
                        'codeDpb',
                        'codeJi',
                        'caseKey',
                        'changeDescription',
                        'changeDescriptionPlace',
                        'changeDescriptionOther',
                        'evaluationResult',
                        'evaluationDescription',
                        'evaluationDescriptionOther',
                        'evaluationUsedSources',
                        'geometryBefore',
                        'geometryAfter',
                        'status',
                    ],
                },
                update: {
                    columns: [
                        'key',
                        'submitDate',
                        'codeDpb',
                        'codeJi',
                        'caseKey',
                        'changeDescription',
                        'changeDescriptionPlace',
                        'changeDescriptionOther',
                        'evaluationResult',
                        'evaluationDescription',
                        'evaluationDescriptionOther',
                        'evaluationUsedSources',
                        'geometryBefore',
                        'geometryAfter',
                        'status',
                    ],
                },
            },
            columns: {
                key: {
                    defaultValue: () => uuid.generate(),
                    schema: Joi.string().uuid(),
                },
                submitDate: {
                    defaultValue: null,
                    schema: Joi.date().allow(null),
                    index: true
                },
                codeDpb: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                codeJi: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                caseKey: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                changeDescription: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                changeDescriptionPlace: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                changeDescriptionOther: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                evaluationResult: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
                evaluationDescription: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                evaluationDescriptionOther: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                evaluationUsedSources: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                },
                geometryBefore: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                    selectExpr: function ({alias}) {
                        return qb.expr.fn('ST_AsGeoJSON', alias);
                    },
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(SQL`ST_GeomFromGeoJSON(${value})`);
                    },
                },
                geometryAfter: {
                    defaultValue: null,
                    schema: Joi.object().allow(null),
                    selectExpr: function ({alias}) {
                        return qb.expr.fn('ST_AsGeoJSON', alias);
                    },
                    modifyExpr: function ({value}) {
                        if (value == null) {
                            return qb.val.inlineParam(null);
                        }

                        return qb.val.raw(SQL`ST_GeomFromGeoJSON(${value})`);
                    },
                },
                status: {
                    defaultValue: null,
                    schema: Joi.string().allow(null),
                    index: true
                },
            },
            relations: {
                view: {
                    type: 'manyToOne',
                    relationTable: 'relations.lpisChangeCaseRelation',
                    ownKey: 'parentLpisChangeCaseKey',
                    inverseKey: 'viewKey',
                    resourceGroup: 'views',
                    resourceType: 'views',
                },
                tag: {
                    type: 'manyToMany',
                    relationTable: 'relations.lpisChangeCaseRelation',
                    ownKey: 'parentLpisChangeCaseKey',
                    inverseKey: 'tagKey',
                    resourceGroup: 'metadata',
                    resourceType: 'tags',
                },
            },
        },
    },
};
