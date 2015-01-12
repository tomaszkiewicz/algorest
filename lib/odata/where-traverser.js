var simpleSqlParser = require('simple-sql-parser');
var sql = require('sql-bricks');
var changeCase = require('change-case');

var connectorOperators = { and: sql.and, or: sql.or };
var conditionOperators = { "is not": sql.isNotNull, is: sql.isNull, in: sql.in, '!=': sql.notEq, '=': sql.eq, '>': sql.gt, '<': sql.lt, '>=': sql.gte, '<=': sql.lte };

function traverse(node, cols) {
  if(node.logic) {
    var terms = [];

    for(var i = 0, term; term = node.terms[i++];)
      terms.push(traverse(term));

    return connectorOperators[node.logic](terms);
  }

  if(node.operator) {
    if(node.operator == '=' && node.right == 'null')
      return sql.isNull(traverse(node.left, cols));

    if(node.operator == '!=' && node.right == 'null')
      return sql.isNotNull(traverse(node.left, cols));

    if(node.operator == 'in') {
      var values = node.right.split(',').map(function(v) {
        return traverse(v, cols);
      });

      return sql.in(traverse(node.left, cols), values);
    }

    return conditionOperators[node.operator](traverse(node.left, cols), traverse(node.right, cols));
  }

  if(cols.indexOf(node) != -1)
    return sql(changeCase.snakeCase(node));

  return sql(node);
}

var operatorsMap = { eq: '=', neq: '!=', gt: '>', lt: '<', gte: '>=', lte: '<=' };

function mapOperators(query) {
  for(var operator in operatorsMap)
    query = query.replace(new RegExp(' ' + operator + ' ', 'g'), ' ' + operatorsMap[operator] + ' ');

  console.log(query);

  return query;
}

function parse(query, cols) {
  var tree = simpleSqlParser.CondParser.parse(mapOperators(query));

  return traverse(tree, cols);
}

module.exports = {
  parse: parse
};