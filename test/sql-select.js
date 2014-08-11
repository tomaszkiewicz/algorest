var should = require('should');
var sqlBuilder = require('../lib/sql-builder');

describe('SELECT queries', function () {
  describe('Basic example', function () {
    it('should generate basic SELECT query', function () {
      var sql = sqlBuilder.browse({ tableName: 'users' });
      sql.should.be.exactly('SELECT * FROM users;');
    });
  });
});
