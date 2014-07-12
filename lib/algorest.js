var odata = require('./odata');
var pgEscape = require('pg-escape');
var pgPrepare = require('pg/lib/utils');
var pg = require('pg');

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

    var evaluateInnerWhere = function(req, query ,prefix) {
        var innerWhere = evaluateOption('', options.where, req, prefix, ' AND ');

        if (innerWhere)
            query = query.replace('%INNERWHERE%', innerWhere);
        else
            query = query.replace('%INNERWHERE%', '');

        return query;
    };

    var prepareSelectQuery = function(req) {
        var query = 'SELECT %COLUMNS% FROM ( SELECT %INNERCOLUMNS% FROM %SOURCE% %INNERWHERE%) AS source';

        var source = evaluateOption('', options.source, req, '', '');

        if(source) {
            query = query.replace('%SOURCE%', '(' + source + ')');
            query = query.replace('%INNERWHERE%', '');
        } else {
            query = query.replace('%SOURCE%', pgEscape.ident(tableName));
            query = evaluateInnerWhere(req, query, 'WHERE');
        }

        var odataCols = evaluateOption('', options.odataSelect, req, '', ', ');

        if(!odataCols)
            odataCols = '*';

        query = query.replace(/%COLUMNS%/g, odataCols);

        var cols = evaluateOption('', options.select, req, '', ', ');

        if(!cols)
            cols = odataCols ? odataCols : '*';

        query = query.replace(/%INNERCOLUMNS%/g, cols);

        return query;
    };

    var browseAction = function(req, res) {
        authorize(req, res, 'browse', tableName);

        var query = prepareSelectQuery(req);

        query = evaluateOption(query, options.odataWhere, req, 'WHERE', ' AND ');
        query = evaluateOption(query, options.odataOrderBy, req, 'ORDER BY', ', ');
        query = evaluateOption(query, options.odataTop, req, 'LIMIT', '');
        query = evaluateOption(query, options.odataSkip, req, 'OFFSET', '');

        console.log(query);

        pg.connect(connectionString, function(err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query(query, [], function(err, result) {
                done();

                if(err) {
                    res.status(400).send(err);
                    return console.error('error running query', err);
                }

                res.send(result.rows);
            });
        });
    };

    var readAction = function(req, res) {
        authorize(req, res, 'read', tableName, req.params.id);

        var query = prepareSelectQuery(req);

        query = evaluateOption(query, [ getIdColumn(tableName) + ' = $1'], req, 'WHERE', ' AND ');

        console.log(query);

        pg.connect(connectionString, function(err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query(query, [req.params.id], function(err, result) {
                done();

                if(err) {
                    res.status(400).send(err);
                    return console.error('error running query', err);
                }

                if(result.rows.length == 0) {
                    res.status(404).send();
                    return;
                }

                res.send(result.rows[0]);
            });
        });
    };

    var editAction = function(req, res) {
        authorize(req, res, 'edit', tableName, req.params.id);

        var query = 'UPDATE %TABLE% SET %SETS% WHERE %IDCOL% = %ID% %INNERWHERE%';

        query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
        query = query.replace(/%IDCOL%/g, getIdColumn(tableName));
        query = query.replace(/%ID%/g, pgPrepare.prepareValue(req.params.id));
        query = evaluateInnerWhere(req, query, 'AND');

        var obj = req.body;

        if(options.validate)
            options.validate(obj);

        if(options.beforeEdit)
            options.beforeEdit(req, obj);

        var colsAndValues = getColsAndValues(obj);
        var sets = [];

        for(var i = 0; i < colsAndValues.cols.length; i++)
            sets.push(colsAndValues.cols[i] + ' = $' + (i+1));

        query = query.replace(/%SETS%/g, sets.join(', '));

        console.log(query);

        pg.connect(connectionString, function(err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query(query, colsAndValues.values, function(err, result) {
                done();

                if(err) {
                    res.status(400).send(err);
                    return console.error('error running query', err);
                }



                if(result.rowCount == 0)
                    res.send(404, null);
                else
                    res.send(204, null);
            });
        });
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

        pg.connect(connectionString, function(err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query(query, colsAndValues.values, function(err, result) {
                done();

                if(err) {
                    res.status(400).send(err);
                    return console.error('error running query', err);
                }

                res.send(201, null);
            });
        });
    };


    var deleteAction = function(req, res) {
        authorize(req, res, 'delete', tableName, req.params.id);

        var query = 'DELETE FROM %TABLE% WHERE %IDCOL% = $1 %INNERWHERE%';

        query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
        query = query.replace(/%IDCOL%/g, getIdColumn(tableName));
        query = evaluateInnerWhere(req, query, 'AND');

        console.log(query);

        pg.connect(connectionString, function(err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query(query, [req.params.id], function(err, result) {
                done();

                if(err) {
                    res.status(400).send(err);
                    return console.error('error running query', err);
                }

                if(result.rowCount == 0)
                    res.send(404, null);
                else
                    res.send(204, null);
            });
        });
    };

    app.get(resourceName, browseAction);
    app.get(elementResourceName, readAction);
    app.put(elementResourceName, editAction);
    app.post(resourceName, addAction);
    app.delete(elementResourceName, deleteAction);
};

module.exports = exports = function(appInstance, connStr) {
    appInstance.rest = rest;
    app = appInstance;
    connectionString = connStr;
};