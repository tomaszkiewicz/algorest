var should = require('should');
var sql = require('../lib/sql');
var schema = require('../lib/schema');

schema.tables.accounts = new schema.Table({
  name: 'accounts',
  columns: [
    { name: 'id', dbType: 'INT', type: Number, nullable: false },
    { name: 'userId', dbType: 'INT', type: Number, nullable: false },
    { name: 'name', dbType: 'TEXT', type: String, nullable: false }
  ]
});

describe('browse queries', function () {
  it('should generate basic SELECT query', function () {
    var browse = sql.browse({ tableName: 'accounts' });
    browse.toString().should.be.exactly('SELECT id, "userId", name FROM accounts');
  });

  it('should generate LIKE filtering', function () {
    var browse = sql.browse({
      tableName: 'accounts',
      where: sql.like('name', 'Algo%')
    });
    browse.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE name LIKE \'Algo%\'');
  });

  it('should generate function filtering', function () {
    var req = { userId: 1 };
    var browse = sql.browse({
      tableName: 'accounts',
      where: function (req) { return { 'userId': req.userId }; }
    }, req);
    browse.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE "userId" = 1');
  });

  it('should generate advanced function filtering', function () {
    var req = { userId: 1 };
    var browse = sql.browse({
      tableName: 'accounts',
      where: sql.and(sql.like('name', 'Algo%'), sql.or({ 'userId': req.userId }, sql.isNull('userId')))
    }, req);
    browse.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE name LIKE \'Algo%\' AND ("userId" = 1 OR "userId" IS NULL)');
  });
});
