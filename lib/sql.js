var _ = require('underscore');
var sql = require('sql-bricks');
var schema = require('./schema');
var utils = require('./utils');

function browse(options, req) {
  var table = schema.tables[options.tableName];
  if (!table) {
    throw new Error('Not found table "' + options.tableName + '" in schema');
  }

  // SELECT
  var query = sql.select(table.columns.map(function (column) { return column.name; }));
  // FROM
  query.from(options.tableName);
  // WHERE
  if (options.where) {
    query.where(utils.tryEval(options.where, req));
  }
  // ORDER BY
  if (options.orderBy) {
    query.orderBy(options.orderBy);
  }

  return query;
}

module.exports = _.extend({
  browse: browse
}, sql);
