var parser = require('odata-parser');
var pgEscape = require('pg-escape');

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

var connectorOperators = { and: 'AND', or: 'OR' };
var conditionOperators = { ne: '!=', eq: '=', gt: '>', lt: '<', ge: '>=', le: '<=' };

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
        return pgEscape.ident(node.name);

    if(node.type == 'literal')
        if(node.value instanceof Array && node.value[0] == 'null')
            return 'null';
        else
            return pgEscape.literal(node.value.toString());

    for(var connectorOperator in connectorOperators)
        if(node.type == connectorOperator)
            return traverse(node.left) + ' ' + connectorOperators[connectorOperator] + ' ' + traverse(node.right);

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

var query = '$filter=(categoryId ne null or categoryId lt 3) and ((accountId eq \'asdf\' or id gt 5) and (sid gt 5 or sid eq 2))';

var result = parser.parse(query);

console.log(result);
console.log('**********');

console.log(query.substring(8));
console.log(treeToSql(result.$filter));