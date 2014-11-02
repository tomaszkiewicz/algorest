var pg = require('pg');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;
var connectionString = '';

function execute(query, values) {
  console.log(query.toString());

  var connection = null;

  try {
    connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
    var result = await(connection.client.query(query.toString(), values, defer()));

    //console.log(result);

    return result;
  } finally {
    if (connection)
      connection.done();
  }
}

module.exports = exports = {
  execute: execute,
  setConnectionString: function(connStr) {
    connectionString = connStr;
  }
};
