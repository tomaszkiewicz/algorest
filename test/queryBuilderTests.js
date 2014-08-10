var config = require('../examples/config.js');
var schemaProvider = require('../lib/schemaProvider.js');
var queryBuilder = require('../lib/queryBuilder.js');
var odata = require('../lib/odata.js');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;

sync.fiber(function() {

    schemaProvider.setDefaultConnectionString(config.connectionString);

    var req = {
        query: {
            $skip: 10,
            $top: 50,
            $orderby: 'date desc, id, test asc',
            $filter: 'categoryId ne null',
            $select: 'id, accountId, categoryId, value, title'
        }
    };
    var options = {
        where: function(req) { return [ 'account_id IN (SELECT id FROM accounts WHERE user_id = $1)', 7 ]},
        beforeAdd: function(req, obj, next) {
            obj.internal = obj.internal || false;
            next();
        },
        //select: [ 'id', 'accountId', 'categoryId' ]
        //select: function(req) { return [ 'id', 'accountId' ]; }
    };
    var tableName = 'transactions';

    odata.applyOdataDefaults(options);

    var queryWithValues = queryBuilder.buildBrowseQuery(req, options, tableName);

    queryBuilder.printQueryWithValues(queryWithValues);
});
