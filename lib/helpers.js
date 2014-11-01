var changeCase = require('change-case');
var schemaProvier = require('./schemaProvider');

var renameProperty = function(obj, oldName, newName) {
    if(oldName == newName) return;

    obj[newName] = obj[oldName];
    delete obj[oldName];
};

// TODO change it to column aliases in select query - it will be faster and cleaner
var renamePropertiesToCamelCase = function(data) {
    if(data instanceof Array) {
        for(var i = 0; i < data.length; i++)
            for(var prop in data[i])
                renameProperty(data[i], prop, changeCase.camelCase(prop));
    } else {
        for(var prop in data)
            renameProperty(data, prop, changeCase.camelCase(prop));
    }

    return data;
};

var whitelistProperties = function(obj, properites) {
    for(var prop in obj) {
        if(properites.indexOf(prop) == -1)
            delete obj[prop];
    }
};

var trimInputObjectToTableColumns = function(obj, tableName) {
    var cols = schemaProvier.getColumns(tableName);
    var pkCol = changeCase.camelCase(schemaProvier.getIdColumn(tableName));

    var index = cols.indexOf(pkCol);

    if (index > -1)
        cols.splice(index, 1);

    whitelistProperties(obj, cols.map(changeCase.camelCase));
};

var intersection = function(A, B) {
    var result = new Array();
    for(i = 0; i < A.length; i++) {
        for(j = 0; j < B.length; j++) {
            if (A[i] == B[j] && result.indexOf(A[i]) == -1) {
                result.push(A[i]);
            }
        }
    }
    return result;
};

var unique = function (value, index, self) {
  return self.indexOf(value) === index;
};

module.exports = {
    renamePropertiesToCamelCase: renamePropertiesToCamelCase,
    whitelistProperties: whitelistProperties,
    trimInputObjectToTableColumns: trimInputObjectToTableColumns,
    intersection: intersection,
    unique: unique
};