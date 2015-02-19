var odata = require('./odata');
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

  odata.applyODataDefaults(options);

  var authorize = function (req, res, action, tableName, id) {
    if (options.authorize) {
      if (!options.authorize(req, action, tableName, id)) {
        res.status(405).send({ error: 'forbidden' });
        return false;
      }
    }

    return true;
  };

  var browseAction = function (req, res) {
    if(!authorize(req, res, 'browse', tableName)) return;

    try {
      var query = builder.buildBrowseQuery(req, tableName, options);
      var result = executor.execute(query);

      res.send(200, result.rows);
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  var readAction = function (req, res) {
    if(!authorize(req, res, 'read', tableName, req.params.id)) return;

    try {
      var query = builder.buildReadQuery(req, tableName, options, req.params.id);
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
    if(!authorize(req, res, 'edit', tableName, req.params.id)) return;

    var obj = req.body;

    // security

    var cols = security.getColumns(req, tableName, options);

    security.trimInputObjectToTableColumns(obj, cols);

    // read item

    var oldItem = null;

    try {
      var readQuery = builder.buildReadQuery(req, tableName, options, req.params.id);
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

    try {
      var query = builder.buildEditQuery(req, tableName, options, newItem, req.params.id);
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      var obj = result.rows[0];

      res.send(200, obj);

      if(options.afterEdit) {
        try {
          if(options.afterEdit instanceof Array)
            for(var i = 0; i < options.afterEdit.length; i++)
              options.afterEdit[i](newItem);
          else
            options.afterEdit(newItem);
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
    if(!authorize(req, res, 'add', tableName)) return;

    var newItem = req.body;

    // security

    var cols = security.getColumns(req, tableName, options);

    security.trimInputObjectToTableColumns(newItem, cols);

    // call beforeAdd

    if (options.beforeAdd) {
      try {
        if(options.beforeAdd instanceof Array)
          for(var i = 0; i < options.beforeAdd.length; i++)
            await(options.beforeAdd[i](req, newItem, defer()));
        else
          await(options.beforeAdd(req, newItem, defer()));
      } catch(ex) {
        res.send(400, 'Validation error');
        return;
      }
    }

    // save to db

    if(newItem.id != undefined)
      delete newItem.id;

    try {
      var query = builder.buildAddQuery(req, tableName, options, newItem);
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(400, null);
        return;
      }

      var obj = result.rows[0];

      res.send(200, obj);

      // call afterAdd

      if(options.afterAdd) {
        try {
          if(options.afterAdd instanceof Array)
            for(var i = 0; i < options.afterAdd.length; i++)
              options.afterAdd[i](obj);
          else
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
    if(!authorize(req, res, 'delete', tableName, req.params.id)) return;

    // read item

    var obj = null;

    try {
      var readQuery = builder.buildReadQuery(req, tableName, options, req.params.id);
      var result = executor.execute(readQuery);

      if(result.rowCount == 0) {
        res.send(404, null);
        return;
      }

      obj = result.rows[0];
    } catch(ex) {
      res.send(500, ex);
      return;
    }

    // call beforeDelete

    if (options.beforeDelete) {
      try {
        if(options.beforeDelete instanceof Array)
          for(var i = 0; i < options.beforeDelete.length; i++)
            await(options.beforeDelete[i](req, obj, defer()));
        else
          await(options.beforeDelete(req, obj, defer()));
      } catch(ex) {
        res.send(400, 'Validation error');
        return;
      }
    }

    // save to db

    try {
      var query = builder.buildDeleteQuery(req, tableName, options, req.params.id);
      var result = executor.execute(query);

      if(result.rowCount == 0) {
        res.send(404, null);
      } else {
        res.send(204, null);

        // call afterDelete

        if(options.afterDelete) {
          try {
              if(options.afterDelete instanceof Array)
                  for(var i = 0; i < options.afterDelete.length; i++)
                      options.afterDelete[i](obj);
              else
                  options.afterDelete(obj);
          } catch(ex) {
              console.log(ex);
          }
        }
      }
    } catch(ex) {
      res.send(500, ex);
      return;
    }
  };

  if(options.authenticate) {
    app.get(resourceName,           options.authenticate, function(req, res) { sync.fiber(function() { try { browseAction(req, res); } catch (ex) { res.status(500).send(ex); } }); });
    app.get(elementResourceName,    options.authenticate, function(req, res) { sync.fiber(function() { try { readAction(req, res);   } catch (ex) { res.status(500).send(ex); } }); });
    app.put(elementResourceName,    options.authenticate, function(req, res) { sync.fiber(function() { try { editAction(req, res);   } catch (ex) { res.status(500).send(ex); } }); });
    app.post(resourceName,          options.authenticate, function(req, res) { sync.fiber(function() { try { addAction(req, res);    } catch (ex) { res.status(500).send(ex); } }); });
    app.delete(elementResourceName, options.authenticate, function(req, res) { sync.fiber(function() { try { deleteAction(req, res); } catch (ex) { res.status(500).send(ex); } }); });
  } else {
    app.get(resourceName,           function(req, res) { sync.fiber(function() { try { browseAction(req, res); } catch (ex) { res.status(500).send(ex); } }); });
    app.get(elementResourceName,    function(req, res) { sync.fiber(function() { try { readAction(req, res);   } catch (ex) { res.status(500).send(ex); } }); });
    app.put(elementResourceName,    function(req, res) { sync.fiber(function() { try { editAction(req, res);   } catch (ex) { res.status(500).send(ex); } }); });
    app.post(resourceName,          function(req, res) { sync.fiber(function() { try { addAction(req, res);    } catch (ex) { res.status(500).send(ex); } }); });
    app.delete(elementResourceName, function(req, res) { sync.fiber(function() { try { deleteAction(req, res); } catch (ex) { res.status(500).send(ex); } }); });
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