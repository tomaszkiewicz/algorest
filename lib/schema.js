function Table(options) {
  this.name = options.name;
  this.columns = options.columns;
  this.isView = options.isView || false;
}

module.exports = {
  tables: {},
  Table: Table
};
