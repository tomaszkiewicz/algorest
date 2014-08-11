function browse(args) {
  var tableName = args.tableName;

  return 'SELECT * FROM ' + tableName + ';';
}

module.exports = {
    browse: browse
};
