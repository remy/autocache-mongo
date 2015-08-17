/*!
 * Autocache Mongo
 * Copyright(c) 2015 Remy Sharp
 * MIT Licensed
 */

var debug = require('debug')('autocache:store');
var MongoClient = require('mongodb').MongoClient;
var port = 27017;
var host = 'localhost';
var database = 'autocache';
var collection;
var noop = function () {};
/**
 * Initialize MongoStore with the given `options`.
 *
 * @param {Object} options
 * @api public
 */

var cache = null;
var connected = false;

function MongoStore(options) {
  if (!(this instanceof MongoStore)) {
    return new MongoStore(options);
  }

  debug('new store');

  if (typeof options === 'function') {
    cache = options;
    options = {
      cache: cache,
    };
  } else if (!options) {
    options = {};
  }

  if (options.cache) {
    cache = options.cache;
    delete options.cache;
    cache.configure({ store: new MongoStore(options) });
    return MongoStore;
  }

  var self = this;

  options = options || {};
  this.prefix = !options.prefix ? 'autocache:' : options.prefix;

  var url = options.url;
  database = options.database || options.db || database;

  if (!url) {
    url = 'mongodb://';
    url += options.host || host;
    url += ':';
    url += options.port || port;
    url += '/' + database;
  }

  // convert to redis connect params
  if (options.client) {
    this.client = options.client;
    connected = true; // ?
    bindEvents();
  } else if (url) {
    debug('connecting via url: %s', url);
    MongoClient.connect(url, function (err, db) {
      self.client = db;
      bindEvents();
    });
  }

  function bindEvents() {
    self.client.createCollection(database, function (err, c) {
      debug('mongo collection: %s', database, collection);
      collection = c;

      connected = true;
      debug('connected');
      if (cache) {
        debug('emitted to cache');
        cache.emit('connect');
      }
    });


    self.client.on('error', function (er) {
      connected = false;
      if (cache) {
        cache.emit('disconnect', er);
      }
    });

    self.client.on('disconnect', function (er) {
      connected = false;
      if (cache) {
        cache.emit('disconnect', er);
      }
    });
  }
}

MongoStore.prototype.dock = function dock(c) {
  cache = c;
  if (connected) {
    debug('emitted to cache');
    cache.emit('connect');
  }
};

MongoStore.prototype.toString = function () {
  return 'MongoStore()';
};

/**
 * Attempt to fetch session by the given `sid`.
 *
 * @param {String} sid
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.get = function (sid, fn) {
  var store = this;
  var psid = store.prefix + sid;
  if (!fn) {
    fn = noop;
  }

  debug('-> get');

  collection.findOne({ _id: psid }, function (er, res) {
    debug('<- get');
    if (er) {
      return fn(er);
    }

    var data = (res || {}).value;

    if (!data) {
      return fn(null);
    }

    var result;
    data = data.toString();

    try {
      result = JSON.parse(data);
    }
    catch (er) {
      return fn(er);
    }
    return fn(null, result);
  });
};

MongoStore.prototype.clear = function (fn) {
  if (!fn) {
    fn = noop;
  }
  debug('-> clear');
  collection.remove({}, function (error) {
    debug('<- clear');
    fn(error);
  }.bind(this));
};

/**
 * Commit the given `sess` object associated with the given `sid`.
 *
 * @param {String} sid
 * @param {Session} sess
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.set = function (sid, value, fn) {
  var store = this;
  var psid = store.prefix + sid;
  if (!fn) {
    fn = noop;
  }

  try {
    value = JSON.stringify(value);
  } catch (er) {
    return fn(er);
  }

  debug('-> set');

  collection.save({
    _id: psid,
    value: value,
  }, function (error) {
    debug('<- set');
    if (error) {
      return fn(error);
    }

    fn.apply(null, arguments);
  });
};

/**
 * Destroy the session associated with the given `sid`.
 *
 * @param {String} sid
 * @api public
 */

MongoStore.prototype.destroy = function (sid, fn) {
  sid = this.prefix + sid;
  debug('-> clear one');
  collection.remove({ _id: sid }, function (error, res) {
    var ret = null;
    if (res && res.result) {
      ret = res.result.n;
    }
    debug('<- clear one', ret);
    if (fn) {
      fn(error, !!ret);
    }
  });
};

module.exports = MongoStore;