var Promise = require('promise');
var logger = require('../common/Logger').applicationWideLogger;

class Info {
    constructor(pgPool) {
        this._pgPool = pgPool;
    }

    statistics(attributes, attributesMap, gid) {
        return attributes.attributes(this.sql.bind(this, gid)).then(attributes => {
            return attributes.map(attribute => attribute.info({
                value: attributesMap[attribute.name()].value,
                attributeName: attributesMap[attribute.name()].attributeName,
                attributeSetName: attributesMap[attribute.name()].attributeSetName
            }));
        });
    }

    sql(gid, baseLayers) {
        return Promise.all(baseLayers
            .map(baseLayer => `SELECT ${baseLayer.queriedColumns.join(',')}, 
                        ST_AsText(ST_Transform(the_geom, 900913)) as geometry, gid, '${baseLayer.location}' as location, '${baseLayer.areaTemplate}' as areaTemplate, name FROM views.layer_${baseLayer._id} WHERE 
                        gid='${gid}'`)
            .map(sql => {
                logger.info('Info#sql Sql', sql);
                return this._pgPool.pool().query(sql)
            })
        );
    }
}

module.exports = Info;