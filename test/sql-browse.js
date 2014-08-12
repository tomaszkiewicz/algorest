var should = require('should');
var sqlBuilder = require('../lib/sql-builder');

describe('SELECT queries', function () {
  describe('Basic example', function () {
    it('should generate basic SELECT query', function () {
      var result = sqlBuilder.browse({ tableName: 'users' });
      result.sql.should.be.exactly('SELECT * FROM users;');
    });

    it('should generate string filtering', function () {
      var result = sqlBuilder.browse({ 
        tableName: 'users',
        where: "name LIKE '%algotronic%'" 
      });
      result.sql.should.be.exactly("SELECT * FROM users WHERE name LIKE '%algotronic%';");
    });

    it('should generate parametrized string filtering', function () {
      var result = sqlBuilder.browse({ 
        tableName: 'accounts',
        where: ["user_id = $?", 5] 
      });
      result.sql.should.be.exactly("SELECT * FROM accounts WHERE user_id = $1;");
    });

    it('should generate function filtering', function () {
      var result = sqlBuilder.browse({ 
        tableName: 'users',
        where: function () { return "name LIKE '%algotronic%'"; }
      });
      result.sql.should.be.exactly("SELECT * FROM users WHERE name LIKE '%algotronic%';");
    });

    it('should generate parametrized function filtering', function () {
      var result = sqlBuilder.browse({ 
        tableName: 'accounts',
        where: function (req) { return ["user_id = $?", 5]; }
      });
      result.sql.should.be.exactly("SELECT * FROM accounts WHERE user_id = $1;");
    });

    it('should generate parametrized function filtering with multiple parameters', function () {
      var result = sqlBuilder.browse({ 
        tableName: 'accounts',
        where: function (req) { return ["user_id = $? \n AND account_type = $?", 5]; }
      });
      result.sql.should.be.exactly("SELECT * FROM accounts WHERE user_id = $1 \n AND account_type = $2;");
    });
  });
});
