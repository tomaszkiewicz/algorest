var _req;
var _sql;
var _parameters;

function browse(args, req) {
  _req = req;
  _sql = '';
  _parameters = [];

  var tableName = args.tableName;
  _sql += 'SELECT ';
  _sql += '* ';
  _sql += 'FROM ' + tableName + ' ';

  _buildWhereClause(args.where);
  _finalizeQuery();

  return {
    sql: _sql,
    parameters: _parameters
  };
}

function _buildWhereClause(where) {
  if (!where) { // where is not given
    return;
  }

  // where is function
  if (typeof where === 'function') {
    where = where(_req); // evaluate function value
  }

  if (Array.isArray(where)) {
    where = where[0];
    _parameters = _parameters.concat(where.slice(1));
  }

  if (typeof where !== 'string') { // where is string
    throw new Error('Invalid where clause: ' + where);
  }

  _sql += 'WHERE ' + where.trim() + ' ';
}

function _finalizeQuery() {
  _sql =  _sql.trim() + ';';
}

module.exports = {
    browse: browse
};
