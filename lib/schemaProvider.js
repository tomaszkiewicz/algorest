var pgEscape = require('pg-escape');
var queryExecutor = require('./queryExecutor');
var changeCase = require('change-case');

var cache = {};
var defaultConnectionString = null;

var getIdColumn = function(tableName, connectionString) {
    var cols = getTableInfo(tableName, connectionString);

    for(var i = 0; i < cols.length; cols++) {
        if(cols[i].primaryKey)
            return pgEscape.ident(cols[i].name);
    }

    return null;
};

var getColumns = function(tableName, connectionString) {
    var cols = getTableInfo(tableName, connectionString);

    return cols.map(function(v) { return v.name });
};

var getTableInfoFromDatabase = function(tableName, connectionString) {
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

    var result = queryExecutor.simpleExecute(connectionString || defaultConnectionString, query, [ tableName ]);

    cache[tableName] = result.rows;

    return result.rows;
};

var getTableInfo = function(tableName, connectionString, skipCache) {
    if(cache[tableName] && !skipCache)
        return cache[tableName];

    return getTableInfoFromDatabase(tableName, connectionString);
};

var setDefaultConnectionString = function(connectionString) {
    defaultConnectionString = connectionString;
};

module.exports = {
    getIdColumn: getIdColumn,
    getTableInfo: getTableInfo,
    getColumns: getColumns,
    setDefaultConnectionString: setDefaultConnectionString
};