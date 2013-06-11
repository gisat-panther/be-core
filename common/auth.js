
var http = require('http');
var conn = require('./conn');
var pg = require('pg');
var sessionCache = {};

function anyUser(req, res, next) {
    if (req.groups && req.groups.length) {
        return next();
    }
    return next(new Error('unauthorized'))
}

function adminUser(req, res, next) {
    if (req.groups && req.groups.indexOf('admingroup') != -1) {
        return next();
    }
    return next(new Error('unauthorized'))
}



function auth(req, res, next) {
    
    var sessionId = req.cookies['ssid']
    if (!sessionId)
        return next();
    req.ssid = sessionId;
    var userName = sessionCache[sessionId]
    if (userName) {
        return fetchUserInfo(userName, req, sessionId, next);
    }

    var headers = {
        'Cookie': 'sessionid=' + sessionId
    };

    var options = {
        host: '192.168.2.8',
        path: '/data/acls',
        headers: headers,
        method: 'GET'
    };
    conn.request(options, null, function(err, output) {
        if (err)
            return next(err);
        var obj = JSON.parse(output);
        if (!obj.name) {
            return next();
        }
        return fetchUserInfo(obj.name, req, sessionId, next);

    })

}

var fetchUserInfo = function(userName, req, sessionId, next) {
    
    var client = conn.getPgDb();
    var sql = 'SELECT u.id, u.username, g.name FROM auth_user u, auth_group g, auth_user_groups ug \n\
                WHERE u.username = $1 AND ug.user_id = u.id AND ug.group_id = g.id'
    client.query(sql, [userName], function(err, result) {

        if (err) {
            return next(err);
        }
        var groups = [];
        var id = null;
        for (var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            groups.push(row.name);
            id = id || row.id;
        }
        req.userId = id;
        req.groups = groups;
        req.userName = userName;
        sessionCache[sessionId] = userName;
        return next();
    });

}

module.exports = {
    auth: auth,
    anyUser: anyUser,
    adminUser: adminUser
}


