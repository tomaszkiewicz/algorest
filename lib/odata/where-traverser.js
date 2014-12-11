var sql = require('sql-bricks');
var changeCase = require('change-case');

var connectorOperators = { and: sql.and, or: sql.or };
var conditionOperators = { ne: sql.notEq, eq: sql.eq, gt: sql.gt, lt: sql.lt, ge: sql.gte, le: sql.lte };

function traverse(node, cols) {
  if(node instanceof Array) {
    if(node.length == 6) {
      var newNode = {
        type: node[5][1],
        left: node[2],
        right: node[5][3][2]
      };

      node = newNode;
    }
  }

  if(node.type == 'property') {
    if(cols && cols.indexOf(node.name) == -1)
      throw Error('Unable to filter on column ' + node.name);

    return sql(changeCase.snakeCase(node.name));
  }

  if(node.type == 'literal') {

    if(node.value instanceof Array && node.value[0] == 'null')
      return null;

    return node.value;
  }

  for(var conditionOperator in conditionOperators)
    if(node.type == conditionOperator)
      return conditionOperators[conditionOperator](traverse(node.left, cols), traverse(node.right, cols));

  for(var connectorOperator in connectorOperators)
    if(node.type == connectorOperator) {}
  return connectorOperators[connectorOperator](traverse(node.left, cols), traverse(node.right, cols));
}

module.exports = {
  traverse: traverse
};