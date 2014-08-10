var pgEscape = require('pg-escape');
var pgPrepare = require('pg/lib/utils');
var schemaProvider = require('./schemaProvider');
var changeCase = require('change-case');
var helpers = require('./helpers');

var printQueryWithValues = function(queryWithValues) {
    console.log(queryWithValues.query);

    for(var i = 0; i < queryWithValues.values.length; i++)
        console.log('\t$' + (i+1) + ' => ' + queryWithValues.values[i]);
};

var getColsAndValues = function(obj) {
    var cols = [];
    var values = [];

    for(var p in obj) {
        cols.push(pgEscape.ident(changeCase.snakeCase(p)));

        var value = obj[p];

        // TODO not all cases are covered

        values.push(pgPrepare.prepareValue(value));    }

    return { cols: cols, values: values };
};

var evaluateWhereOption = function(whereOption, req, prefix) {
    if(!prefix)
        prefix = 'WHERE';

    if(whereOption) {
        var result = '';

        if(typeof whereOption == 'function')
            result = whereOption(req);
        else
            result = whereOption;

        if(result instanceof Array) {
            return {
                query: '\n\t' + prefix + ' ' + result[0],
                values: result.slice(1)
            };
        }
    }

    return null;
};

var evaluateInnerWhere = function(req, query, whereOption, prefix) {
    var innerWhere = evaluateWhereOption(whereOption, req, prefix);

    var values = [];

    if (innerWhere) {
        query = query.replace('%INNERWHERE%', innerWhere.query);
        values = innerWhere.values;
    } else
        query = query.replace('%INNERWHERE%', '');

    return { query: query, values: values };
};

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
            return inputString + ' ' + prefix + ' ' + result;
    }

    return inputString;
};

var evaluateIfFunction = function(option, req) {
    if(option) {
        var result = null;

        if(typeof option == 'function')
            result = option(req);
        else
            result = option;

        return result;
    }

    return null;
};

var prepareSelectQuery = function(req, options, tableName) {
    var dbCols = schemaProvider.getColumns(tableName);
    var odataCols = evaluateIfFunction(options.odataSelect, req);
    var innerCols = evaluateIfFunction(options.select, req);

    var outputCols = dbCols.map(changeCase.camelCase);

    if(innerCols)
        outputCols = helpers.intersection(outputCols, innerCols);

    if(odataCols != null)
        outputCols = helpers.intersection(outputCols, odataCols);

    var dbColsNames = outputCols.map(changeCase.snakeCase);

    var cols = [];

    for(var i = 0; i < dbColsNames.length; i++)
        if(dbColsNames[i] == outputCols[i])
            cols.push(outputCols[i]);
        else
            cols.push(dbColsNames[i] + ' AS "' + outputCols[i] + '"');

    var query = 'SELECT %COLUMNS% FROM \n(\n\tSELECT %INNERCOLUMNS% FROM %SOURCE% %INNERWHERE% \n) AS source';

    query = query.replace(/%COLUMNS%/g, outputCols.map(function(v) { return '"' + v + '"'; }).join(', '));
    query = query.replace(/%INNERCOLUMNS%/g, cols.join(', '));

    var source = evaluateIfFunction(options.source, req);

    var innerWhere = null;

    if(source) {
        query = query.replace('%SOURCE%', '(' + source + ')');
        query = query.replace('%INNERWHERE%', '');
    } else {
        query = query.replace('%SOURCE%', pgEscape.ident(tableName));

        innerWhere = evaluateInnerWhere(req, query, options.where);

        query = innerWhere.query;
    }

    var values = [];

    if(innerWhere && innerWhere.values)
        values = innerWhere.values;

    return { query: query, values: values };
};

var buildBrowseQuery = function(req, options, tableName) {
    var selectQuery = prepareSelectQuery(req, options, tableName);
    var query = selectQuery.query;

    var dbCols = schemaProvider.getColumns(tableName);
    var outputCols = dbCols.map(changeCase.camelCase);

    query = evaluateOption(query, options.odataWhere, req, '\nWHERE', ' AND ');

    var orderByQuery = evaluateIfFunction(options.odataOrderBy, req);

    if(orderByQuery) {
        var orderBy = {};
        var orderByStatements = orderByQuery.split(',');

        for(var i = 0; i < orderByStatements.length; i++) {
            var statementParts = orderByStatements[i].trim().split(' ');

            if(outputCols.indexOf(statementParts[0]) == -1)
                continue;

            if(statementParts.length == 1) {
                orderBy[statementParts[0]] = 'ASC';
            } else {
                if(statementParts[1].toLowerCase() == 'asc' || statementParts[1].toLowerCase() == 'desc') {
                    orderBy[statementParts[0]] = statementParts[1].toUpperCase();
                } else {
                    orderBy[statementParts[0]] = 'ASC';
                }
            }
        }

        var outputOrderBy = [];

        for(var prop in orderBy)
            outputOrderBy.push('"' + prop + "' " + orderBy[prop]);

        query += '\nORDER BY ' + outputOrderBy.join(', ');
    }

    query = evaluateOption(query, options.odataTop, req, '\nLIMIT', '');
    query = evaluateOption(query, options.odataSkip, req, '\nOFFSET', '');

    return { query: query, values: selectQuery.values };
};

var buildReadQuery = function(req, options, tableName, id) {
    var selectQuery = prepareSelectQuery(req, options, tableName);
    var query = selectQuery.query;

    query = evaluateOption(query, [ schemaProvider.getIdColumn(tableName) + ' = $' + (selectQuery.values.length + 1)], req, 'WHERE', ' AND ');

    var values = selectQuery.values.concat([id]);

    return { query: query, values: values };
};

var buildEditQuery = function(req, updateObj, tableName, id, whereOption) {
    var query = 'UPDATE %TABLE% SET %SETS% WHERE %IDCOL% = %ID% %INNERWHERE%';

    query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
    query = query.replace(/%IDCOL%/g, schemaProvider.getIdColumn(tableName));
    query = query.replace(/%ID%/g, pgPrepare.prepareValue(id));

    // TODO can be null
    var innerWhere = evaluateInnerWhere(req, query, whereOption, 'AND');

    query = innerWhere.query;

    var colsAndValues = getColsAndValues(updateObj);
    var sets = [];

    for(var i = 0; i < colsAndValues.cols.length; i++)
        sets.push(colsAndValues.cols[i] + ' = $' + (i+1+(innerWhere.values.length || 0)));

    query = query.replace(/%SETS%/g, sets.join(', '));

    var values = innerWhere.values.concat(colsAndValues.values);

    return { query: query, values: values };
};

var buildAddQuery = function(req, addObj, tableName) {
    var query = 'INSERT INTO %TABLE% (%COLS%) VALUES (%VALUES%) RETURNING %IDCOL%';

    query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
    query = query.replace(/%IDCOL%/g, schemaProvider.getIdColumn(tableName));

    var colsAndValues = getColsAndValues(addObj);
    var placeholders = [];

    for(var i = 0; i < colsAndValues.values.length; i++)
        placeholders.push('$' + (i+1));

    query = query.replace(/%COLS%/g, colsAndValues.cols.join(', '));
    query = query.replace(/%VALUES%/g, placeholders.join(', '));

    return { query: query, values: colsAndValues.values };
};

var buildDeleteQuery = function(req, tableName, id, whereOption) {
    var query = 'DELETE FROM %TABLE% WHERE %IDCOL% = %ID% %INNERWHERE%';

    query = query.replace(/%TABLE%/g, pgEscape.ident(tableName));
    query = query.replace(/%IDCOL%/g, schemaProvider.getIdColumn(tableName));

    // TODO can be null
    var innerWhere = evaluateInnerWhere(req, query, whereOption, 'AND');

    query = innerWhere.query;

    var values = innerWhere.values.concat([id]);

    query = query.replace(/%ID%/g, '$' + (values.length));

    return { query: query, values: values };
};

module.exports = {
    buildBrowseQuery: buildBrowseQuery,
    buildReadQuery: buildReadQuery,
    buildEditQuery: buildEditQuery,
    buildAddQuery: buildAddQuery,
    buildDeleteQuery: buildDeleteQuery,
    printQueryWithValues: printQueryWithValues
};