function SqlResult() {
  this._parts = [];
  this._cachedSql = null;
  this.parameters = [];
}

SqlResult.prototype.append = function append(obj) {
  var part, parameters;

  if (typeof obj === 'string') {
    part = obj;
    parameters = [];
  } else {
    part = obj.sql;
    parameters = obj.parameters || [];
  }

  if (typeof part !== 'string') {
    throw new Error('Cannot append non-string to SQL');
  }

  var self = this;
  part = part.replace(/\$\?/g, function () {
    if (!parameters.length) {
      throw new Error('Missing parameter for placeholder');
    }
    self.parameters.push(parameters.shift());
    return '$' + self.parameters.length;
  });

  this._parts.push(part);
  this._cachedSql = null;
};

Object.defineProperty(SqlResult.prototype, 'sql', {
  get: function () { 
    if (!this._cachedSql) {
      this._cachedSql = this._parts.join('').trim() + ';'; 
    }
    return this._cachedSql;
  },
  enumerable: true,
  configurable: true
});

module.exports = SqlResult;
