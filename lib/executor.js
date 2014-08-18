function execute(query, cb) {
  console.log(query);

  cb(null, { rowCount: 0});
}

module.exports = {
  execute: execute
};
