var odata = require('./odata');
var pgEscape = require('pg-escape');
var pgPrepare = require('pg/lib/utils');
var pg = require('pg');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;

var connectionString = '';
var app = null;

var evaluateOption = function(inputString, option, req, prefix, delimiter) {
    if(option) {
        var result = '';

        if(typeof option == 'function')
            result = option(req);
        else
            result = option;

        if(result instanceof Array)
            result = result.join(delimiter);

        if(result)
            return inputString + '\n' + prefix + ' ' + result;
    }

    return inputString;
};

var evaluateWhereOption = function(option, req, prefix) {
    if(!prefix)
        prefix = 'WHERE';

    if(option) {
        var result = '';

        if(typeof option == 'function')
            result = option(req);
        else
            result = option;

        if(result instanceof Array) {
            return {
                query: '\n' + prefix + ' ' + result[0],
                values: result.slice(1)
            };
        }
    }

    return null;
};

var applyOdataDefaults = function(options) {
    if(!options.odataTop)
        options.odataTop = odata.top;

    if(!options.odataSkip)
        options.odataSkip = odata.skip;

    if(!options.odataWhere)
        options.odataWhere = odata.where;

    if(!options.odataOrderBy)
        options.odataOrderBy = odata.orderBy;

    if(!options.odataSelect)
        options.odataSelect = odata.select;
};

var getColsAndValues = function(obj) {
    var cols = [];
    var values = [];

    for(var p in obj) {
        cols.push(pgEscape.ident(p));

        var value = obj[p];

        // TODO not all cases are covered

        values.push(pgPrepare.prepareValue(value));    }

    return { cols: cols, values: values };
};

var getIdColumn = function(tableName) {
    // TODO cache schema and read from cached schema for specified table
    return pgEscape.ident('id');
};

var rest = function(tableName, options) {
    if(!options)
        options = {};

    var resourceName = '/' + (options.resourceName || tableName);
    var elementResourceName = resourceName + '/:id';

    applyOdataDefaults(options);

    var authorize = function(req, res, action, tableName, id) {
        if(options.authorize)
            if(!options.authorize(req, action, tableName, id)) {
                res.status(405).send({ error: 'forbidden' });
                throw new Error('User is forbidden to do ' + action + ' on table ' + tableName);
            }
    };

    var evaluateInnerWhere = function(req, query, prefix) {
        var innerWhere = evaluateWhereOption(options.where, req, prefix);

        if (innerWhere)
            query = query.replace('%INNERWHERE%', innerWhere.query);
        else
            query = query.replace('%INNERWHERE%', '');

        return { query: query, values: innerWhere.values || [] };
    };

    var prepareSelectQuery = function(req) {
        var query = 'SELECT %COLUMNS% FROM ( SELECT %INNERCOLUMNS% FROM %SOURCE% %INNERWHERE%) AS source';

        var source = evaluateOption('', options.source, req, '', '');

        if(source) {
            query = query.replace('%SOURCE%', '(' + source + ')');
            query = query.replace('%INNERWHERE%', '');
        } else {
            query = query.replace('%SOURCE%', pgEscape.ident(tableName));

            var innerWhere = evaluateInnerWhere(req, query);

            query = innerWhere.query;
        }

        var odataCols = evaluateOption('', options.odataSelect, req, '', ', ');

        if(!odataCols)
            odataCols = '*';

        query = query.replace(/%COLUMNS%/g, odataCols);

        var cols = evaluateOption('', options.select, req, '', ', ');

        if(!cols)
            cols = odataCols ? odataCols : '*';

        query = query.replace(/%INNERCOLUMNS%/g, cols);

        return { query: query, values: innerWhere.values };
    };

    var browseAction = function(req, res) {
        authorize(req, res, 'browse', tableName);

        var selectQuery = prepareSelectQuery(req);
        var query = selectQuery.query;

        query = evaluateOption(query, options.odataWhere, req, 'WHERE', ' AND ');
        query = evaluateOption(query, options.odataOrderBy, req, 'ORDER BY', ', ');
        query = evaluateOption(query, options.odataTop, req, 'LIMIT', '');
        query = evaluateOption(query, options.odataSkip, req, 'OFFSET', '');

        console.log(query);

        var connection = null;

        try {
            connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
            var result = await(connection.client.query(query, selectQuery.values || [], defer()));

            res.send(result.rows);
        } catch(err) {
            res.status(400).send(err);
            return console.error('error running query', err);
        }

        if(connection)
            connection.done();
    };

    var readAction = function(req, res) {
        authorize(req, res, 'read', tableName, req.params.id);

        var selectQuery = prepareSelectQuery(req);
        var query = selectQuery.query;

        query = evaluateOption(query, [ getIdColumn(tableName) + ' = $' + (selectQuery.values.length + 1)], req, 'WHERE', ' AND ');

        console.log(query);

        var connection = null;

        try {
            connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
            var result = await(connection.client.query(query, selectQuery.values.concat([req.params.id]), defer()));

            if(result.rows.length == 0) {
                res.status(404).send();
                return;
            }

            res.send(result.rows[0]);

        } catch(err) {
            res.status(400).send(err);
            return console.error('error running query', err);
        }

        if(connection)
            connection.done();
    };

    var editAction = function(req, res) {
        authorize(req, res, 'edit', tableName, req.params.id);

        var query = 'UPDATE %TABLE% SET %SETS% WHERE %IDCOL% = %ID% %INNERWHERE%';

        query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
        query = query.replace(/%IDCOL%/g, getIdColumn(tableName));
        query = query.replace(/%ID%/g, pgPrepare.prepareValue(req.params.id));

        // TODO can be null
        var innerWhere = evaluateInnerWhere(req, query, 'AND');

        query = innerWhere.query;

        var obj = req.body;

        if(options.validate)
            options.validate(obj);

        if(options.beforeEdit)
            options.beforeEdit(req, obj);

        var colsAndValues = getColsAndValues(obj);
        var sets = [];

        for(var i = 0; i < colsAndValues.cols.length; i++)
            sets.push(colsAndValues.cols[i] + ' = $' + (i+1+(innerWhere.values.length || 0)));

        query = query.replace(/%SETS%/g, sets.join(', '));

        console.log(query);

        var connection = null;

        // TODO can be null
        var values = innerWhere.values.concat(colsAndValues.values);

        try {
            connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
            var result = await(connection.client.query(query, values, defer()));

            if(result.rowCount == 0)
                res.send(404, null);
            else
               res.send(204, null);

        } catch(err) {
            res.status(400).send(err);
            return console.error('error running query', err);
        }

        if(connection)
            connection.done();
    };

    var addAction = function(req, res) {
        authorize(req, res, 'add', tableName);

        var query = 'INSERT INTO %TABLE% (%COLS%) VALUES (%VALUES%) RETURNING %IDCOL%';

        query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
        query = query.replace(/%IDCOL%/g, getIdColumn(tableName));

        var obj = req.body;

        if(options.validate)
            options.validate(obj);

        if(options.beforeAdd)
            options.beforeAdd(req, obj);

        var colsAndValues = getColsAndValues(obj);

        query = query.replace(/%COLS%/g, colsAndValues.cols.join(', '));
        //query = query.replace(/%VALUES%/g, colsAndValues.values.join(', '));

        var placeholders = [];

        for(var i = 0; i < colsAndValues.values.length; i++)
            placeholders.push('$' + (i+1));

        query = query.replace(/%VALUES%/g, placeholders.join(', '));

        console.log(query);

        var connection = null;

        try {
            connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
            var result = await(connection.client.query(query, colsAndValues.values, defer()));

            res.send(201, null);

        } catch(err) {
            res.status(400).send(err);
            return console.error('error running query', err);
        }

        if(connection)
            connection.done();
    };

    var deleteAction = function(req, res) {
        authorize(req, res, 'delete', tableName, req.params.id);

        var query = 'DELETE FROM %TABLE% WHERE %IDCOL% = $1 %INNERWHERE%';

        query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
        query = query.replace(/%IDCOL%/g, getIdColumn(tableName));
        query = evaluateInnerWhere(req, query, 'AND');

        console.log(query);

        var connection = null;

        try {
            connection = await(pg.connect(connectionString, sync.defers('client', 'done')));
            var result = await(connection.client.query(query, [req.params.id], defer()));

            if(result.rowCount == 0)
                res.send(404, null);
            else
                res.send(204, null);

        } catch(err) {
            res.status(400).send(err);
            return console.error('error running query', err);
        }

        if(connection)
            connection.done();
    };

    if(options.authenticate) {
        app.get(resourceName, options.authenticate, function(req, res) { sync.fiber(function() { browseAction(req, res); }); });
        app.get(elementResourceName, options.authenticate, function(req, res) { sync.fiber(function() { readAction(req, res); }); });
        app.put(elementResourceName, options.authenticate, function(req, res) { sync.fiber(function() { editAction(req, res); }); });
        app.post(resourceName, options.authenticate, function(req, res) { sync.fiber(function() { addAction(req, res); }); });
        app.delete(elementResourceName, options.authenticate, function(req, res) { sync.fiber(function() { deleteAction(req, res); }); });
    } else {
        app.get(resourceName, function(req, res) { sync.fiber(function() { browseAction(req, res); }); });
        app.get(elementResourceName, function(req, res) { sync.fiber(function() { readAction(req, res); }); });
        app.put(elementResourceName, function(req, res) { sync.fiber(function() { editAction(req, res); }); });
        app.post(resourceName, function(req, res) { sync.fiber(function() { addAction(req, res); }); });
        app.delete(elementResourceName, function(req, res) { sync.fiber(function() { deleteAction(req, res); }); });
    }
};

module.exports = exports = function(appInstance, connStr) {
    appInstance.rest = rest;
    app = appInstance;
    connectionString = connStr;
};