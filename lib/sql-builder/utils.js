function evalDefinition(def, req) {
  var parameters = [];

  if (!def) {
    return;
  }

  if (typeof def === 'function') {
    def = def(req);
  }

  if (Array.isArray(def)) {
    parameters = def.slice(1);
    def = def[0];
  }

  if (typeof def !== 'string') {
    throw new Error('Invalid def, expected evaluation to string instead of: ' + def);
  }

  return {
    sql: def,
    parameters: parameters
  };
}

module.exports = {
  evalDefinition: evalDefinition
};
