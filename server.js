    
var express = require('express');
var app = express();
var staticFn = express['static'];

var async = require('async');
var loc = require('./common/loc');

function initServer() {
    
    // Order is important
    var oneDay = 60*60*24*1000;
    //app.use(express.favicon());
    //app.use(express.favicon(__dirname + '/public/images/puma-logo.png'));
    app.use('/public/extjs-4.1.3',staticFn(__dirname + '/public/extjs-4.1.3', {maxAge: oneDay*7}));
    app.use('/public',staticFn(__dirname + '/public'));
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(loc.langParser);
    require('./routes/security')(app);
    require('./routes/routes')(app);
    require('./routes/finish')(app);
    app.listen(3000);
    console.log('Listening on port 3000'); 
}

async.series([
    function(callback) {
        require('./common/conn').init(app,callback);
    },
    function(callback) {
        loc.init(callback);
    }],
    initServer
);

