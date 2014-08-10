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

    whitelistProperties(obj, cols.map(changeCase.camelCase));
};

module.exports = {
    renamePropertiesToCamelCase: renamePropertiesToCamelCase,
    whitelistProperties: whitelistProperties,
    trimInputObjectToTableColumns: trimInputObjectToTableColumns
};