var pg = require('pg');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;

var executeQueryWithValues = function(connectionString, queryWithValues, res, success) {
    var connection = null;

    try {
        connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
        var result = await(connection.client.query(queryWithValues.query, queryWithValues.values, defer()));

        if(success)
            success(result);

    } catch(err) {
        res.status(400).send(err);
        console.error('Error running query', err);
    }

    if(connection)
        connection.done();
};

module.exports = {
    executeQueryWithValues: executeQueryWithValues
};