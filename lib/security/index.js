var schema = require('../schema');
var schemaSynchronizer = require('../schema-synchronizer');
var helpers = require('../helpers');

function whitelistProperties(obj, properites) {
  for(var prop in obj)
    if(properites.indexOf(prop) == -1)
      delete obj[prop];
};

var trimInputObjectToTableColumns = function(obj, cols) {
  var index = cols.indexOf('id');

  if (index > -1)
    cols.splice(index, 1);

  whitelistProperties(obj, cols);
};

function getColumns(req, tableName, options) {
  if(!schema[tableName])
    schemaSynchronizer.synchronizeTableSchema(tableName, schema);

  var outputCols = schema[tableName].columns.map(function (col) { return col.name });

  if(options.select) {
    var selectCols = utils.tryEval(options.select, req);

    outputCols = helpers.intersection(outputCols, selectCols)
  }

  if(options.blacklist) {
    var blacklistCols = utils.tryEval(options.blacklist, req);

    for(var i = 0; i < blacklistCols.length; i++) {
      var index = outputCols.indexOf(blacklistCols[i]);

      if (index > -1)
        outputCols.splice(index, 1);
    }
  }

  return outputCols;
};

module.exports = {
  trimInputObjectToTableColumns: trimInputObjectToTableColumns,
  getColumns: getColumns
};