var top = function(req) {
    return req.query.$top;
};

var skip = function(req) {
    return req.query.$skip;
};

var orderBy = function(req) {
    return req.query.$orderby;
};

var select = function(req) {
    if(req.query.$select)
        return req.query.$select.split(',').map(function(v) { return v.trim(); });

    return null;
};

var where = function(req) {
    var where = req.query.$filter;

    if(!where) return;

    where = where.replace(/\seq\s/g, ' = ');
    where = where.replace(/\slt\s/g, ' < ');
    where = where.replace(/\sle\s/g, ' <= ');
    where = where.replace(/\sgt\s/g, ' > ');
    where = where.replace(/\sge\s/g, ' >= ');
    where = where.replace(/\sne\s/g, ' != ');

    return where;
};

var applyOdataDefaults = function(options) {
    if(!options.odataTop)
        options.odataTop = top;

    if(!options.odataSkip)
        options.odataSkip = skip;

    if(!options.odataWhere)
        options.odataWhere = where;

    if(!options.odataOrderBy)
        options.odataOrderBy = orderBy;

    if(!options.odataSelect)
        options.odataSelect = select;
};

module.exports = exports = {
    top: top,
    skip: skip,
    orderBy: orderBy,
    select: select,
    where: where,
    applyOdataDefaults: applyOdataDefaults
};