


var cp = require('child_process');
var fs = require('fs');


function exporter(params, req, res, callback) {
    //var fullUrl = req.protocol + "://" + req.get('host') + req.url;

    var fullUrl = "http://"+require('../common/conn').getRemoteAddress()+req.url;
    var url = fullUrl.replace(params.download ? 'print' : 'image', 'printpublic');
    url += params.download ? '&fordownload=1' : '';
    var imgId = 'snap_' + generateId() + '.png';
    var outFile = 'tmp/' + imgId;
    var isWin = !!process.platform.match(/^win/);
    var phantomName = isWin ? 'phantomjs.exe'  : 'phantomjs';
    console.log("URL: ",url," outFile: ",outFile);
    cp.execFile(phantomName, ['--ssl-protocol=tlsv1 --debug=true', 'rasterize.js', url, outFile, '-', 1], {}, function(err, stdout, stderr) {
        console.log("err: ",err);
        console.log("stdout: -------------------------\n",stdout,"\n---------------------------------\n");
        console.log("stderr: ",stderr);
        
        if (params['download']) {
            res.downFile = [outFile, imgId];
            return callback(err);
        }
        else {
            
            fs.readFile(outFile, function(err, data) {
                if (err)
                    return callback(err);
                res.data = data;
                res.contType = 'image/png';
                res.encType = 'utf8';
                res.set('Cache-Control','max-age=60000000')
                callback()
                fs.unlink(outFile);
            })
        }
    })
//    else cp.exec('phantomjs rasterize.js '+url+' '+outFile+' - 1',{maxBuffer: 5000 * 1024}, function(err, stdout, stderr) {
//        if (params['download']) {
//            res.downFile = [outFile, imgId]
//            return callback(err);
//        }
//        else {
//            
//            fs.readFile(outFile, function(err, data) {
//                if (err)
//                    return callback(err);
//                res.data = data;
//                res.contType = 'image/png';
//                res.encType = 'utf8';
//                res.set('Cache-Control','max-age=60000000')
//                callback()
//                fs.unlink(outFile);
//            })
//        }
//    })
}

var generateId = function() {
    var time = new Date().getTime();
    var random = Math.round(Math.random() * 100000000);
    var id = time.toString(32) + random.toString(32);
    return id;
}

module.exports = {
    exporter: exporter
}


