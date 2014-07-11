algorest
=========

Package allows to expose your PostgreSQL database via REST service, allowing you to query it with OData operators.

## Installation

```sh
npm install algorest --save
```

## Basic usage

```js
var express = require('express');
var http = require('http');
var algorest = require('algorest');

var app = express();
app.set('port', process.env.PORT || 4000);
app.use(express.logger('dev'));
app.use(express.bodyParser());

var connStr = 'postgres://user:password@server/database';

// Here algorest comes to action

algorest(app, 'accounts', connStr); 

// The rest is as usual

http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
```

## Supported HTTP methods

In the example above we have published some URLs to handle table operations. We follow BREAD (Browse, Read, Edit, Add, Delete) principle in constructing URLs:

* Browse: GET /accounts - to read rows from table
* Read: GET /accounts/id - to read row with specified id
* Edit: PUT /accounts/id - to edit existing row
* Add: POST /accounts - to insert new row into table
* Delete: DELETE /accounts/id - to remove row with specified id from table

## Supported OData operators

We currently support the following operators:

* $select
* $filter
* $top
* $skip
* $orderby 

In their basic usage - that means there are no functions like startswith implemented yet.

## Advanced usage

For more advanced usage we need to provide options object as 4th argument:

```js
var options = {};

algorest(app, 'accounts', connStr, options); 
```

Options object can have any combination of following properties:

#### resrouceName

Specifies URL resource name that the database table will be available at, for example:

```js
var options = {
    resourceName: 'konta' // konta = accounts in Polish
};

algorest(app, 'accounts', connStr, options); 
```

Will expose table accounts table under /konta URL.

#### authorize

Defines custom function to authorize the request to specified resource.
The function has following signature and has to return true if authorization is sucessful:

```js
function(req, action, tableName, id) {
    if(action=='delete') return false;

    return true;
};
```
Action parameter is one of: browse, read, add, edit or delete. id parameters is not available with browse action.

tableName parameter allows you to use one function for many tables - eg. in claims based security scenarios.

#### beforeEdit

Defines function that can be used to intercept edit request and change item properties. The signature of this function is:

```js
function(req, item) {
    item.modifiedAt = new Date();
},

```

Function gets request object and item object and can modify item in any way, for example (as you can see above) you can define modifiedAt property and assign current time.

#### beforeAdd

This function works the same way as beforeEdit described above. It is called before new row is inserted into the table and allows you to modify inserted object.

#### select

Property allows you to specify string, array or function that provides a range of columns you want to limit the output query to. Provided you want to limit columns from account table to id and name only you can write:

```js
var options = {
    select: [ 'id', 'name' ]
};

algorest(app, 'accounts', connStr, options); 

```
You can also define select property as a function with signature:

```js
function(req) {
    return ['id','name'];
}
```

#### where

The property allows you to define filtering string, array of filtering conditions or function that returns filtering string or array of filtering strings. This filtering strings are combined into output WHERE part of query and allows you to limit results to the rows user is allowed to read.

Lets pretend that we user some authentication system that assigns current user id to req.user.id property and we want to filter accounts to the accounts user is owner of, basing on userId column of table accounts:


```js
var options = {
    where: function(req) {
        return 'userId = ' + req.user.id; // remember about sanitizing your custom filters! 
    }
};

algorest(app, 'accounts', connStr, options); 

```

#### source

This property allows you to override source table with your own SQL query. You can specify the query as string or as a function that satisfies the following signature and returns query string:

```js
function(req) {
    return 'SELECT * FROM accounts_filtered';
}
```

## Advanced example

```js
var options = {
    resourceName: 'konta',
    select: [ 'id', 'name', 'balance', 'currency' ], // we skip other columns like userId, modifiedAt, createdAt
    where: function(req) {
        return 'userId = ' + req.user.id; // remember about sanitizing your custom filters! 
    }, 
    beforeEdit: function(req, item) {
        item.modifiedAt = new Date();
    },
    beforeAdd: function(req, item) {
        item.createdAt = new Date();
        item.userId = req.user.id;
    },
    authorize: function(req, action, tableName, id) {
        // let's deny deleting of records, user can only read, browse, edit and add new items
        return action!='delete';
    }
};

algorest(app, 'accounts', connStr, options); 
```

It's worth mentioning that algorest apply where condition also for edit and delete requests, 
so, in above example, user is not able to edit or delete other users accounts.

## Known issues

We are not happy about input validation and sanitization right now, so it's better not to use this version of package in production environment.

## Tests

  Not yet available

## Release History

* 0.1.0 Initial release