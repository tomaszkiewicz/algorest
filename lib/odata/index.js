var parser = require('odata-parser');
var sql = require('sql-bricks');
var whereTraverser = require('./where-traverser');

function where(req, cols) {
  var filter = req.query.$filter;

  if(filter) {
    var tree = parser.parse('$filter=' + filter);

    return whereTraverser.traverse(tree.$filter, cols);
  }
}

function returnIfExists(req, operator) {
  var param = req.query[operator];

  if(param) {
    var output = parser.parse(operator + '=' + req.query[operator]);

    return output[operator];
  }
}

function applyODataDefaults(options) {
  if(!options.oDataTop)
    options.oDataTop = function(req) { return returnIfExists(req, '$top'); };

  if(!options.oDataSkip)
    options.oDataSkip = function(req) { return returnIfExists(req, '$skip'); };

  if(!options.oDataWhere)
    options.oDataWhere = where;

  if(!options.oDataOrderBy)
    options.oDataOrderBy = function(req) { return returnIfExists(req, '$orderby'); };

  if(!options.oDataSelect)
    options.oDataSelect = function(req) { return returnIfExists(req, '$select'); };
}

module.exports = {
  applyODataDefaults: applyODataDefaults
};