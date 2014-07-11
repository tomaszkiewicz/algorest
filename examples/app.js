var express = require('express');
var http = require('http');
var algorest = require('..');

var app = express();

app.set('port', process.env.PORT || 4000);

app.use(express.logger('dev'));
app.use(express.bodyParser());
//app.use(express.methodOverride());


var selectFunc = function(req) {
    return ['id', 'name', 'date'];
};

var whereFunc1 = function(req) {
    return  ['id < 12', 'id > 0'];
};

var whereFunc2 = function(req) {
    return 'id < 12';
};

var whereUserId = function(req) {
    return 'userId == ' + req.user.id;
};

var customQuery = function(req) {
    return 'SELECT * FROM users';
}

var authorize = function(req, action, tableName, id) {
    //if(action=='delete') return false;

    return true;
};

var connStr = 'postgres://algorest:dahF1vx@192.168.128.103/algorest';

algorest(app, 'accounts', connStr);

algorest(app, 'accounts', connStr, {
    resourceName: 'konta',
    //source: 'SELECT * FROM accounts JOIN users.....',
    afterSave: function() {},
    authorize: authorize,
    validate: function() {},
    beforeSave: function() {},
    afterSave: function() {},
    beforeEdit: function(req, item) {
        //item.modifiedAt = new Date();
    },
    beforeAdd: function(req, item) {
        //item.createdAt = new Date();
        item.userId = 1;
    },
    where: 'userid = 1'
});

http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});