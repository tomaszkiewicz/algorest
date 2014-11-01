var odata = require('./odata');
var helpers = require('./helpers');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;
var _ = require('underscore');
var sql = require('./sql');
var utils = require('./utils');
var security = require('./security');
var executor = require('./executor');

var connectionString = '';
var app = null;
var defaultOptions = {};

var rest = function (tableName, options) {
  if (!options) {
    options = defaultOptions;
  }

  var resourceName = '/' + (options.resourceName || tableName);
  var elementResourceName = resourceName + '/:id';

  //odata.applyOdataDefaults(options);

  var authorize = function (req, res, action, tableName, id) {
    if (options.authorize) {
      if (!options.authorize(req, action, tableName, id)) {
        res.status(405).send({ error: 'forbidden' });
        throw new Error('User is forbidden to do ' + action + ' on table ' + tableName);
      }
    }
  };

  var browseAction = function (req, res) {
    authorize(req, res, 'browse', tableName);

    var cols = security.getColumns(req, tableName, options);

    var query = (sql
      .select(cols)
      .from(tableName)
      .where(utils.tryEval(options.where, req) || {})
      // TODO order by, top, limit
    );

    var top = utils.tryEval(options.oDataTop, req) || null;

    if(top)
      query = query.limit(top);

    var skip = utils.tryEval(options.oDataSkip, req) || null;

    if(skip)
      query = query.offset(skip);

    try {
      var result = executor.execute(query);

      // TODO consider AS or invoking helpers.renamePropertiesToCamelCase here

      res.send(200, result.rows);
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var readAction = function (req, res) {
    authorize(req, res, 'read', tableName, req.params.id);

    var cols = security.getColumns(req, tableName, options);

    var query = (sql
      .select(cols)
      .from(tableName)
      .where(sql.and({ id: req.params.id }), utils.tryEval(options.where, req) || {})
    );

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      // TODO consider AS or invoking helpers.renamePropertiesToCamelCase here

      var obj = result.rows[0];

      res.send(200, obj);
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var editAction = function (req, res) {
    authorize(req, res, 'edit', tableName, req.params.id);

    var obj = req.body;

    // security

    var cols = security.getColumns(req, tableName, options);

    security.trimInputObjectToTableColumns(obj, cols);

    // read item

    var oldItem = read(); // TODO

    // apply changes

    var newItem = _.extend({}, oldItem, obj);

    // call beforeEdit

    if (options.beforeEdit) {
      try {
        if(options.beforeEdit instanceof Array) {
          for(var i = 0; i < options.beforeEdit.length; i++) {
            await(options.beforeEdit[i](req, oldItem, newItem, defer()));
          }
        } else {
          await(options.beforeEdit(req, oldItem, newItem, defer()));
        }
      } catch(ex) {
        res.send(400, 'Validation error');
        return;
      }
    }

    // save to db

    if(newItem.id != undefined)
      delete newItem.id;

    var query = (sql
      .update(tableName, newItem)
      .where(sql.and({ id: req.params.id }), utils.tryEval(options.where, req) || {})
      .returning(cols)
    );

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      var obj = result.rows[0];

      res.send(200, obj);

      if(options.afterEdit) {
        try {
          options.afterEdit(obj);
        } catch(ex) {
          console.log(ex);
        }
      }
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var addAction = function (req, res) {
    authorize(req, res, 'add', tableName);

    var obj = req.body;

    helpers.trimInputObjectToTableColumns(obj, tableName);

    if (options.validate)
      try {
        if (!await(options.validate(req, obj, 'edit', defer()))) {
          res.status(400).send({ reason: 'Validation failed'});
          return;
        }
      } catch (err) {
        res.status(400).send(err);
        console.error('validate (addAction): ' + err);
        return;
      }

    if (options.beforeAdd)
      try {
        await(options.beforeAdd(req, obj, defer()));
      } catch (err) {
        res.status(400).send(err);
        return;
      }

    var queryWithValues = queryBuilder.buildAddQuery(req, obj, tableName);

    queryBuilder.printQueryWithValues(queryWithValues);

    queryExecutor.executeQueryWithValues(connectionString, queryWithValues, res, function (data) {
      res.send(201, null);
    });
  };

  var deleteAction = function (req, res) {
    authorize(req, res, 'delete', tableName, req.params.id);

    var query = (sql
      .delete()
      .from(tableName)
      .where(sql.and({ id: req.params.id }), utils.tryEval(options.where, req) || {})
    );

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(404, null);
      } else {
        res.send(204, null)
      }
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  if(options.authenticate) {
    app.get(resourceName,           options.authenticate, function(req, res) { sync.fiber(function() { browseAction(req, res); }); });
    app.get(elementResourceName,    options.authenticate, function(req, res) { sync.fiber(function() { readAction(req, res); }); });
    app.put(elementResourceName,    options.authenticate, function(req, res) { sync.fiber(function() { editAction(req, res); }); });
    app.post(resourceName,          options.authenticate, function(req, res) { sync.fiber(function() { addAction(req, res); }); });
    app.delete(elementResourceName, options.authenticate, function(req, res) { sync.fiber(function() { deleteAction(req, res); }); });
  } else {
    app.get(resourceName,           function(req, res) { sync.fiber(function() { browseAction(req, res); }); });
    app.get(elementResourceName,    function(req, res) { sync.fiber(function() { readAction(req, res); }); });
    app.put(elementResourceName,    function(req, res) { sync.fiber(function() { editAction(req, res); }); });
    app.post(resourceName,          function(req, res) { sync.fiber(function() { addAction(req, res); }); });
    app.delete(elementResourceName, function(req, res) { sync.fiber(function() { deleteAction(req, res); }); });
  }
};

module.exports = exports = function (appInstance, connStr, options) {
  appInstance.rest = rest;
  app = appInstance;
  connectionString = connStr;
  executor.setConnectionString(connStr);

  if (options)
    defaultOptions = options;
};