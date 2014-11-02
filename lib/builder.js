var sql = require('sql-bricks');
var security = require('./security');
var helpers = require('./helpers');
var utils = require('./utils');

function buildBrowseQuery(req, tableName, options) {
  var cols = security.getColumns(req, tableName, options);
  var colsNoOData = security.getColumns(req, tableName, options, true);
  var colsAs = helpers.getAliasedColumnList(cols);

  var query = (sql
    .select(colsAs)
    .from(tableName)
    .where(utils.tryEval(options.where, req) || {})
  );

  var where = utils.tryEval(options.oDataWhere, req, colsNoOData) || null;

  if(where)
    query = query.where(where);

  var top = utils.tryEval(options.oDataTop, req) || null;

  if(top)
    query = query.limit(top);

  var skip = utils.tryEval(options.oDataSkip, req) || null;

  if(skip)
    query = query.offset(skip);

  var orderBy = utils.tryEval(options.oDataOrderBy, req) || null;

  if(orderBy) {
    orderBy = helpers.renamePropertiesToSnakeCase(orderBy);

    var orderCols = [];

    for(var i = 0, item; item = orderBy[i++];)
      for(var prop in item)
        orderCols.push(prop + ' ' + item[prop]);

    query = query.orderBy(orderCols.join(', '));
  }

  return query;
}

function buildReadQuery(req, tableName, options, id) {
  var cols = security.getColumns(req, tableName, options);
  var colsAs = helpers.getAliasedColumnList(cols);

  var query = (sql
    .select(colsAs)
    .from(tableName)
    .where(sql.and({ id: id }), utils.tryEval(options.where, req) || {})
  );

  return query;
}

function buildEditQuery(req, tableName, options, newItem, id) {
  var cols = security.getColumns(req, tableName, options);
  var colsAs = helpers.getAliasedColumnList(cols);

  var query = (sql
    .update(tableName, helpers.renamePropertiesToSnakeCase(newItem))
    .where(utils.tryEval(options.where, req) || {})
    .returning(colsAs)
  );

  return query;
}

function buildAddQuery(req, tableName, options, newItem) {
  var cols = security.getColumns(req, tableName, options);
  var colsAs = helpers.getAliasedColumnList(cols);

  // TODO change do be:
  /*INSERT INTO accounts select * from (
   (select * from accounts limit 0)
   UNION ALL
   values(-1, 'abc', 'pln', 2, 3, 4, '123456', 'abcvdef')
   ) x
   where user_id=7*/

  var query = (sql
    .insert(tableName)
    .values(helpers.renamePropertiesToSnakeCase(newItem))
    .returning(colsAs)
  );

  return query;
}

function buildDeleteQuery(req, tableName, options, id) {
  var query = (sql
    .delete()
    .from(tableName)
    .where(sql.and({ id: id }), utils.tryEval(options.where, req) || {})
  );

  return query;
}

module.exports = exports = {
  buildBrowseQuery: buildBrowseQuery,
  buildReadQuery: buildReadQuery,
  buildEditQuery: buildEditQuery,
  buildAddQuery: buildAddQuery,
  buildDeleteQuery: buildDeleteQuery
};