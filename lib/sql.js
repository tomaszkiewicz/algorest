var _ = require('underscore');
var sqlBricks = require('sql-bricks');
var schema = require('./schema');
var utils = require('./utils');

function selectTable(tableName) {
  var table = schema.tables[tableName];
  if (!table) {
    throw new Error('Not found table "' + tableName + '" in schema');
  }
  return (sqlBricks
    .select(table.columns.map(function (column) { return column.name; }))
    .from(tableName)
  );
}

module.exports = _.extend({}, sqlBricks, {
  selectTable: selectTable
});
