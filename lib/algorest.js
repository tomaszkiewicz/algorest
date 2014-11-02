var odata = require('./odata');
var helpers = require('./helpers');
var sync = require('synchronize');
var await = sync.await;
var defer = sync.defer;
var _ = require('underscore');
var security = require('./security');
var executor = require('./executor');
var builder = require('./builder');

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

    var query = builder.buildBrowseQuery(req, tableName, options);

    try {
      var result = executor.execute(query);

      res.send(200, result.rows);
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var readAction = function (req, res) {
    authorize(req, res, 'read', tableName, req.params.id);

    var query = builder.buildReadQuery(req, tableName, options, req.params.id);

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(404, null);
        return;
      }

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

    var readQuery = builder.buildReadQuery(req, tableName, options, req.params.id);
    var oldItem = null;

    try {
      var result = executor.execute(readQuery);

      if(result.rowCount == 0) {
        res.send(404, null);
        return;
      }

      oldItem = result.rows[0];
    } catch(ex) {
      res.send(500, ex);
      return;
    }

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

    var query = builder.buildEditQuery(req, tableName, options, newItem, id);

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      var obj = result.rows[0];

      res.send(200, obj);

      // TODO handle Arrays
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

    var newItem = req.body;

    // security

    var cols = security.getColumns(req, tableName, options);

    security.trimInputObjectToTableColumns(newItem, cols);

    // call beforeAdd

    if (options.beforeAdd) {
      try {
        if(options.beforeAdd instanceof Array) {
          for(var i = 0; i < options.beforeAdd.length; i++) {
            await(options.beforeAdd[i](req, newItem, defer()));
          }
        } else {
          await(options.beforeAdd(req, newItem, defer()));
        }
      } catch(ex) {
        res.send(400, 'Validation error');
        return;
      }
    }

    // save to db

    if(newItem.id != undefined)
      delete newItem.id;

    var query = builder.buildAddQuery(req, tableName, options, newItem);

    try {
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      var obj = result.rows[0];

      res.send(200, obj);

      // TODO handle Arrays
      if(options.afterAdd) {
        try {
          options.afterAdd(obj);
        } catch(ex) {
          console.log(ex);
        }
      }
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var deleteAction = function (req, res) {
    authorize(req, res, 'delete', tableName, req.params.id);

    var query = builder.buildDeleteQuery(req, tableName, options, req.params.id);

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