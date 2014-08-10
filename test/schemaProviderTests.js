var config = require('../examples/config.js');
var schemaProvider = require('../lib/schemaProvider.js');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;

sync.fiber(function() {

    schemaProvider.setDefaultConnectionString(config.connectionString);

    var tables = ['accounts','categories','transactions','banks'];

    for(var i in tables) {
        var pkCol = schemaProvider.getIdColumn(tables[i]);

        console.log('Primary key for table ' + tables[i] + ' is ' + pkCol);
        console.log('Columns in table ' + tables[i] + ' are: ');
        console.log(schemaProvider.getColumns(tables[i]));
    }
});
