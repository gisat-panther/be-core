Ext.define('Puma.model.LayerRef', {
    extend: 'Ext.data.Model',
    fields: [

    '_id','name','implicit','columnMap','location','layer','fidColumn','isData','nameColumn','parentColumn','areaTemplate','attributeSet','year','wmsAddress','wmsLayers'
    ],
    idProperty: '_id',
    proxy: {
        type: 'rest',
        url : Cnst.url+'/rest/layerref',
        reader: {
            type: 'json',
            root: 'data'
        },
        writer: {
            type: 'json',
            writeAllFields: false,
            root: 'data'
        }
    }
});


