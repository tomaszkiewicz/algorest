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

  for (var i = 0; i < parameters.length; i++) {
    this.parameters.push(parameters[i]);
    part.replace(/\$?/, this._replacePlaceholder.bind(this));
  }

  this._parts.push(part);
};

SqlResult.prototype._replacePlaceholder = function () {
  return '$' + this.parameters.length;
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
