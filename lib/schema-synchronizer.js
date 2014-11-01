var executor = require('./executor');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;

function synchronizeTableSchema(tableName, schema) {
  var tableInfo = getTableInfoFromDatabase(tableName);

  schema.tables[tableName] = new schema.Table({
    name: tableName,
    columns: tableInfo.map(function(c) {
      return {
        name: c.name,
        dbType: c.type,
        nullable: c.notnull == 't',
        type: getJavaScriptType(c.type)
      };
    })
  });
}

function getJavaScriptType(type) {
  switch (type) {
    case 'bigint':
    case 'double precision':
    case 'integer':
      return Number;

    // TODO add other types

    default:
      return String;
  }
}

function getTableInfoFromDatabase(tableName) {
  var query = function(){/*
   SELECT
   f.attnum AS number,
   f.attname AS name,
   f.attnum,
   f.attnotnull AS notNull,
   pg_catalog.format_type(f.atttypid,f.atttypmod) AS type,
   CASE
   WHEN p.contype = 'p' THEN true
   ELSE false
   END AS "primaryKey",
   CASE
   WHEN p.contype = 'u' THEN true
   ELSE false
   END AS "uniqueKey",
   CASE
   WHEN p.contype = 'f' THEN g.relname
   END AS "foreignKey",
   CASE
   WHEN p.contype = 'f' THEN p.confkey
   END AS "foreignKeyFieldNum",
   CASE
   WHEN p.contype = 'f' THEN g.relname
   END AS "foreignKey",
   CASE
   WHEN p.contype = 'f' THEN p.conkey
   END AS "foreignKeyConnNum",
   CASE
   WHEN f.atthasdef = 't' THEN d.adsrc
   END AS default
   FROM pg_attribute f
   JOIN pg_class c ON c.oid = f.attrelid
   JOIN pg_type t ON t.oid = f.atttypid
   LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
   LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
   LEFT JOIN pg_constraint p ON p.conrelid = c.oid AND f.attnum = ANY (p.conkey)
   LEFT JOIN pg_class AS g ON p.confrelid = g.oid
   WHERE
   --c.relkind = 'r'::char
   --AND n.nspname = '%s'  -- Replace with Schema name
   --AND
   c.relname = $1  -- Replace with table name
   AND f.attnum > 0 ORDER BY number
   ;
   */}.toString().slice(14,-3);

  var result = executor.execute(query, [ tableName ]);

  return result.rows;
}

module.exports = {
  synchronizeTableSchema: synchronizeTableSchema
};