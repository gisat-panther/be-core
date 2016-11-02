var conn = require('../common/conn');
var Promise = require('promise');
var _ = require('underscore');
var logger = require('../common/Logger').applicationWideLogger;

var MongoAttribute = require('../attributes/MongoAttribute');
var NumericAttribute = require('../attributes/NumericAttribute');
var TextAttribute = require('../attributes/TextAttribute');
var BooleanAttribute = require('../attributes/BooleanAttribute');
var FilteredBaseLayers = require('../layers/FilteredBaseLayers');

/**
 * It loads values from the postgresql database.
 */
class Attributes {
    /**
     *
     * @param areaTemplate {Number} Id of the areaTemplate
     * @param periods {Number[]} Array of the ids for periods
     * @param places {Number[]} Array of the ids for places
     * @param attributes {Object[]}
     */
    constructor(areaTemplate, periods, places, attributes) {
        this._areaTemplate = areaTemplate;
        this._periods = periods;
        this._places = places;
        this._attributes = attributes;
    }

    attributes(sqlProducer) {
        let mongoAttributes = {};
        return Promise.all(this._attributes.map(attribute => {
            return new MongoAttribute(Number(attribute.attribute), conn.getMongoDb()).json();
        })).then(attributes => {
            logger.info('Attributes#attributes attributes', attributes);
            attributes.forEach(attribute => {
                mongoAttributes[attribute._id] = attribute;
            });

            return this._dataViews(sqlProducer, mongoAttributes);
        }).then(dataViews => {
            logger.info('Attributes#attributes dataViews', dataViews);
            let attributes = {};

            dataViews.forEach(dataView => {
                this._dataView(dataView, attributes);
            });

            let attributesPromises = Object.keys(attributes)
                .filter(attribute => attribute != 'geometry' && attribute != 'gid' && attribute != 'location' && attribute != 'areatemplate' && attribute != 'name')
                .map(attribute => {
                    var id = Number(attribute.split('_')[3]);
                    let jsonAttribute = mongoAttributes[id];

                    jsonAttribute.values = attributes[attribute];
                    jsonAttribute.geometries = attributes['geometry'];
                    jsonAttribute.names = attributes['name'];
                    jsonAttribute.gids = attributes['gid'];
                    jsonAttribute.areaTemplates = attributes['areatemplate'].map(base => Number(base));
                    jsonAttribute.locations = attributes['location'].map(base => Number(base));
                    jsonAttribute.column = attribute;

                    if (jsonAttribute.type == 'numeric') {
                        return new NumericAttribute(jsonAttribute);
                    } else if (jsonAttribute.type == 'boolean') {
                        return new BooleanAttribute(jsonAttribute);
                    } else if (jsonAttribute.type == 'text') {
                        return new TextAttribute(jsonAttribute);
                    } else {
                        logger.warn(`Statistics#statisticAttributes Unknown type of attribute. id: ${id}`);
                        return null
                    }
                })
                .filter(attribute => attribute != null);

            return Promise.all(attributesPromises);
        });
    }

    _dataView(dataView, attributes) {
        if(!dataView || !dataView.rows) {
            return;
        }

        dataView.rows.forEach(row => {
            Object.keys(row).forEach(key => {
                if (!attributes[key]) {
                    attributes[key] = [];
                }
                attributes[key].push(row[key]);
            })
        });
    }

    _dataViews(sqlProducer, mongoAttributes) {
        var areaTemplate = this._areaTemplate;
        var periods = this._periods;
        var places = this._places;
        return new FilteredBaseLayers({
            areaTemplate: areaTemplate,
            isData: false,
            year: {$in: periods},
            location: {$in: places}
        }, conn.getMongoDb()).read().then(baseLayers => {
            logger.info('Attributes#_dataViews baseLayers', baseLayers);
            // Store the base layers as they will be needed later.
            baseLayers.forEach(baseLayer => baseLayer.queriedColumns = []);
            this._attributes
                .map(attribute => `as_${attribute.attributeSet}_attr_${attribute.attribute}`)
                .forEach(column => {
                    baseLayers
                        .filter(baseLayer => baseLayer.columns.indexOf(column) != -1)
                        .forEach(baseLayer => baseLayer.queriedColumns.push(column))
                });

            return sqlProducer(baseLayers, mongoAttributes);
        })
    }
}

module.exports = Attributes;