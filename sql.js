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
    var query = sql.selectTable('accounts');
    query.toString().should.be.exactly('SELECT id, "userId", name FROM accounts');
  });

  it('should generate LIKE filtering', function () {
    var query = (sql
      .selectTable('accounts')
      .where(sql.like('name', 'Algo%'))
    );
    query.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE name LIKE \'Algo%\'');
  });

  it('should generate function filtering', function () {
    var req = { userId: 1 };
    var query = (sql
      .selectTable('accounts')
      .where({ 'userId': req.userId })
    );
    query.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE "userId" = 1');
  });

  it('should generate advanced function filtering', function () {
    var req = { userId: 1 };
    var query = (sql
      .selectTable('accounts')
      .where(sql.and(sql.like('name', 'Algo%'), sql.or({ 'userId': req.userId }, sql.isNull('userId'))))
    );
    query.toString().should.be.exactly('SELECT id, "userId", name FROM accounts WHERE name LIKE \'Algo%\' AND ("userId" = 1 OR "userId" IS NULL)');
  });

  it('should generate SELECT with subquery string as source', function () {
    var query = (sql
      .select()
      .from('(SELECT * FROM accounts WHERE NOT "isDeleted") accounts')
    );
    query.toString().should.be.exactly('SELECT * FROM (SELECT * FROM accounts WHERE NOT "isDeleted") accounts');
  });

  it('should generate SELECT with subquery object as source', function () {
    var query = (sql
      .select()
      .from(sql.selectTable('accounts').where({ isDeleted: false }).as('accounts'))
    );
    query.toString().should.be.exactly('SELECT * FROM (SELECT id, "userId", name FROM accounts WHERE "isDeleted" = FALSE) accounts');
  });
});
