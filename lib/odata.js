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
    return req.query.$select;
};

var where = function(req) {
    var where = req.query.$filter;

    if(!where) return;

    where = where.replace(/eq/g, '==');
    where = where.replace(/lt/g, '<');
    where = where.replace(/le/g, '<=');
    where = where.replace(/gt/g, '>');
    where = where.replace(/ge/g, '>=');
    where = where.replace(/ne/g, '!=');

    return where;
};

module.exports = exports = {
    top: top,
    skip: skip,
    orderBy: orderBy,
    select: select,
    where: where
};