var utils = require('./utils');

function whereClause(def, req) {
  if (!def) {
    return '';
  }

  var evaluated = utils.evalDefinition(def, req);

  return {
    sql: 'WHERE ' + evaluated.sql.trim() + ' ',
    parameters: evaluated.parameters
  };
}

module.exports = whereClause;
