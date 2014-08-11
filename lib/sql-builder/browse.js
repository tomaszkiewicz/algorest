var whereClause = require('./where-clause');
var SqlResult = require('./sql-result');

function browse(args, req) {
  var sqlResult = new SqlResult();

  sqlResult.append('SELECT ');
  sqlResult.append('* ');
  sqlResult.append('FROM ' + args.tableName + ' ');
  sqlResult.append(whereClause(args.where, req));

  return sqlResult;
}

module.exports = browse;
