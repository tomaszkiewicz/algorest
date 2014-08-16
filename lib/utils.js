function tryEval(obj /*, ... params */) {
  if (typeof obj === 'function') {
    return obj.apply(null, Array.prototype.slice.call(arguments, 1));
  }
  return obj;
}

module.exports = {
  tryEval: tryEval
};
