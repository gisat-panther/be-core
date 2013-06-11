var dataMod = require('./data');
var fs = require('fs')
var async = require('async')
var crud = require('../rest/crud')

function getChart(params, callback) {

    var years = JSON.parse(params['years']);
    var attrs = JSON.parse(params['attrs']);
    var moreYears = years.length > 1;
    dataMod.getAttrConf(params, function(err, attrMap) {
        if (err)
            return callback(err);
        attrMap = attrMap.attrMap;
        var columns = [{
                dataIndex: 'name',
                text: 'Name',
                flex: 1,
                minWidth: 120,
                filter: {
                    type: 'string'
                }
            }];
        var fields = ['gid', 'name', 'at', 'loc'];
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            var attrConf = attrMap[attr.as][attr.attr];
            var attrName = attrConf.name;
            for (var j = 0; j < years.length; j++) {
                var year = years[j];
                var dataIndex = 'as_' + attr.as + '_attr_' + attr.attr;
                dataIndex += moreYears ? ('_y_' + year) : '';
                columns.push({
                    dataIndex: dataIndex,
                    xtype: 'numbercolumn',
                    format: '0.00',
                    text: attrName,
                    minWidth: 100,
                    filter: {
                        type: 'numeric'
                    }
                })
                fields.push(dataIndex);

            }
        }


        var result = {
            columns: columns,
            fields: fields,
            units: attrMap.units
        }
        callback(null, result);
    })
}

function createCsv(params, callback) {
    var fileName = 'tmp/' + generateId() + '.csv';
    var attrs = JSON.parse(params['attrs']);
    var years = JSON.parse(params['years']);
    params['limit'] = null;
    params['start'] = null;
    
    var opts = {
        data: function(asyncCallback) {
            dataMod.getData(params, function(err, dataObj) {
                if (err)
                    return callback(err);
                return asyncCallback(null, dataObj);
            })
        },
        attrConf: ['data', function(asyncCallback) {
                var newAttrs = JSON.parse(params['attrs'])
                if (params['normalization'] == 'attributeset') {
                    newAttrs.push({as: params['normalizationAttributeSet'], attr: -1})
                }
                if (params['normalization'] == 'attribute') {
                    newAttrs.push({as: params['normalizationAttributeSet'], attr: params['normalizationAttribute']})
                }
                params['attrs'] = JSON.stringify(newAttrs);
                dataMod.getAttrConf(params, function(err, attrMap) {
                    if (err)
                        return callback(err);
                    
                    return asyncCallback(null, attrMap)
                })
            }],
        yearMap: function(asyncCallback) {
            crud.read('year', {_id: {$in: years}}, function(err, resls) {
                if (err)
                    return callback(err);
                var yearMap = {};
                for (var i=0;i<resls.length;i++) {
                    yearMap[resls[i]._id] = resls[i];
                }
                return asyncCallback(null, yearMap)
            })
        },
        file: function(asyncCallback) {
            fs.open(fileName, 'w', asyncCallback);
        },
        result: ['data', 'attrConf','yearMap', function(asyncCallback, results) {
                var data = results.data.data;
                var attrs = JSON.parse(params['attrs']);
                var attrArray = [];
                var firstRow = '"GID","NAME"';
                var normalization = params['normalization'];
                var normText = '';
                var fileText = '';
                if (normalization && normalization != 'none') {
                    var text = '';
                    if (normalization == 'area') {
                        text = 'area'
                    }
                    if (normalization == 'toptree') {
                        text = results.data.aggData[0].name
                    }
                    if (normalization == 'attributeset' || normalization == 'attributeset') {
                        text = results.attrConf.attrSetMap[params['normalizationAttributeSet']].name;
                    }
                    if (normalization == 'attribute') {
                        text += '-' + results.attrConf.attrMap[params['normalizationAttributeSet']][params['normalizationAttribute']].name;
                    }
                    normText = '(norm. by ' + text + ')';
                }
                for (var i = 0; i < attrs.length; i++) {
                    var attr = attrs[i];
                    for (var j = 0; j < years.length; j++) {
                        var year = years[j];
                        attrArray.push('as_' + attr.as + '_attr_' + attr.attr + (years.length > 1 ? '_y_' + year : ''))
                        firstRow += ',"';
                        firstRow += results.attrConf.attrSetMap[attr.as].name + '-';
                        firstRow += results.attrConf.attrMap[attr.as][attr.attr].name;
                        firstRow += ' '+results.yearMap[year].name+' ';
                        firstRow += normText+' ('
                        firstRow += results.attrConf.attrMap.units+')"';
                    }
                }
                fileText += firstRow + '\n';
                
                for (var i=0;i<data.length;i++) {
                    var row = data[i];
                    var rowText = row.gid+','+row.name;
                    for (var j=0;j<attrArray.length;j++) {
                        var attrName = attrArray[j];
                        rowText += ',';
                        rowText += row[attrName];
                    }
                    
                    fileText += rowText+'\n';
                }
                fs.writeFile(fileName,fileText,function(err) {
                    if (err)
                        return callback(err);
                    return callback(null,fileName);
                })

            }]
    }
    async.auto(opts);
}


var generateId = function() {
    var time = new Date().getTime();
    var random = Math.round(Math.random() * 100000000);
    var id = time.toString(32) + random.toString(32);
    return id;
}

module.exports = {
    getChart: getChart,
    createCsv: createCsv
}
