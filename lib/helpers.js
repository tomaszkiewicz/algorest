var changeCase = require('change-case');

function getAliasedColumList(cols) {
  if(!cols)
    return null;

  var aliasedCols = [];

  for(var i = 0, col; col = cols[i++];)
    aliasedCols.push(col + ' AS "' + changeCase.camelCase(col) + '"');

  return aliasedCols.join(', ');
}

function intersection(A, B) {
  var result = new Array();
  for(i = 0; i < A.length; i++) {
    for(j = 0; j < B.length; j++) {
      if (A[i] == B[j] && result.indexOf(A[i]) == -1) {
        result.push(A[i]);
      }
    }
  }
  return result;
}

function renameProperty(obj, oldName, newName) {
  if(oldName == newName) return;

  obj[newName] = obj[oldName];
  delete obj[oldName];
}

function renamePropertiesToCamelCase(data) {
  if(data instanceof Array) {
    for(var i = 0; i < data.length; i++)
      for(var prop in data[i])
        renameProperty(data[i], prop, changeCase.camelCase(prop));
  } else {
    for(var prop in data)
      renameProperty(data, prop, changeCase.camelCase(prop));
  }

  return data;
}

function renamePropertiesToSnakeCase(data) {
  if(data instanceof Array) {
    for(var i = 0; i < data.length; i++)
      for(var prop in data[i])
        renameProperty(data[i], prop, changeCase.snakeCase(prop));
  } else {
    for(var prop in data)
      renameProperty(data, prop, changeCase.snakeCase(prop));
  }

  return data;
};


module.exports = {
  intersection: intersection,
  getAliasedColumnList: getAliasedColumList,
  renamePropertiesToSnakeCase: renamePropertiesToSnakeCase,
  renamePropertiesToCamelCase: renamePropertiesToCamelCase
};