var parser = require('odata-parser');
var pgEscape = require('pg-escape');
var sql = require('sql-bricks');
var util = require('util');

var odataQueries = [
  '$top=10&$skip=5&$select=categoryId, accountId',
  '$filter=categoryId ne null',
  '$orderby=sid desc, id asc, date desc',
  '$orderby=sid desc, id, date desc',
  '$orderby=sid, id, asdf',
  '$top=asdf'
];

//for(var i = 0; i < odataQueries.length; i++) {
//    var result = parser.parse(odataQueries[i]);
//
//    console.log();
//    console.log(odataQueries[i]);
//    console.log(result);
//    //console.log(JSON.stringify(result));
//}

var connectorOperators = { and: sql.and, or: sql.or };
var conditionOperators = { ne: sql.notEq, eq: sql.eq, gt: sql.gt, lt: sql.lt, ge: sql.gte, le: sql.lte };

var traverse = function(node) {

  //console.log(node);

  if(node instanceof Array) {
    var out = '(' + traverse(node[2]) + ')';

    if(node.length == 6 && node[5] instanceof Array) {
      out += ' ' + connectorOperators[node[5][1]] + ' ' + traverse(node[5][3]);
    }

    return out;
  }

  if(node.type == 'property')
    return sql(node.name);

  if(node.type == 'literal')
    if(node.value instanceof Array && node.value[0] == 'null')
      return 'null';
    else
      return pgEscape.literal(node.value.toString());

  for(var connectorOperator in connectorOperators)
    if(node.type == connectorOperator)
      return traverseSqlBricks(node.left) + ' ' + connectorOperators[connectorOperator] + ' ' + traverse(node.right);

  for(var conditionOperator in conditionOperators)
    if(node.type == conditionOperator)
      return traverse(node.left) + ' ' + conditionOperators[conditionOperator] + ' ' + traverse(node.right);
};

var treeToSql = function(node) {
  var output = traverse(node);

  output = output.replace(/!= null/g, 'IS NOT NULL');
  output = output.replace(/= null/g, 'IS NULL');

  return output;
};

function traverseSqlBricks(node) {
//    console.log('Traversing node:');
//    console.log(util.inspect(node, { depth: 10 }));

    if(node instanceof Array) {
      if(node.length == 6) {
        var newNode = {
          type: node[5][1],
          left: node[2],
          right: node[5][3][2]
        };

//        console.log('New node:')
//        console.log(util.inspect(newNode, { depth: 10 }));

        node = newNode;
      }
    }

    if(node.type == 'property') {
      return sql(node.name);
    }

    if(node.type == 'literal') {

      if(node.value instanceof Array && node.value[0] == 'null')
        return null;

      return node.value;
    }

    for(var conditionOperator in conditionOperators)
      if(node.type == conditionOperator)
        return conditionOperators[conditionOperator](traverseSqlBricks(node.left), traverseSqlBricks(node.right));

    for(var connectorOperator in connectorOperators)
      if(node.type == connectorOperator) {}
        return connectorOperators[connectorOperator](traverseSqlBricks(node.left), traverseSqlBricks(node.right));

}

var query = '$filter=(categoryId ne null or categoryId lt 35) and ((accountId eq \'asdf\' or id gt 55) and (sid gt 105 or sid eq 202))';
//var query = '$filter=categoryId eq \'adesf56\'';

query = '$filter=categoryId eq \'54\'';

var result = parser.parse(query);

console.log(util.inspect(result.$filter, { depth: 10 }));
console.log('**********');


var where = traverseSqlBricks(result.$filter);

//where = sql.gt(sql('test'), 5);

console.log(query.substring(8));
console.log(util.inspect(sql.select().from('test').where(where).toString(), { depth: 10 }));
console.log(util.inspect(where, { depth: 10 }));
//console.log(treeToSql(result.$filter));