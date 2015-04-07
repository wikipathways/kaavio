/* */ 
(function(process) {
  var inherits = require("util").inherits;
  var EventEmitter = require("events").EventEmitter;
  exports = module.exports = function(xs, ee, mappingHint) {
    return new Stream(xs, ee, mappingHint);
  };
  var _ = exports;
  var ArrayProto = Array.prototype,
      ObjProto = Object.prototype;
  var slice = ArrayProto.slice,
      toString = ObjProto.toString;
  _.isFunction = function(x) {
    return typeof x === 'function';
  };
  _.isObject = function(x) {
    return typeof x === 'object' && x !== null;
  };
  _.isString = function(x) {
    return typeof x === 'string';
  };
  _.isArray = Array.isArray || function(x) {
    return toString.call(x) === '[object Array]';
  };
  if (typeof setImmediate === 'undefined') {
    if (typeof process === 'undefined' || !(process.nextTick)) {
      _.setImmediate = function(fn) {
        setTimeout(fn, 0);
      };
    } else {
      _.setImmediate = process.nextTick;
    }
  } else if (typeof process === 'undefined' || !(process.stdout)) {
    _.setImmediate = function(fn) {
      setImmediate(fn);
    };
  } else {
    _.setImmediate = setImmediate;
  }
  var _global = this;
  if (typeof global !== 'undefined') {
    _global = global;
  } else if (typeof window !== 'undefined') {
    _global = window;
  }
  if (!_global.nil) {
    _global.nil = {};
  }
  var nil = _.nil = _global.nil;
  _.curry = function(fn) {
    var args = slice.call(arguments);
    return _.ncurry.apply(this, [fn.length].concat(args));
  };
  _.ncurry = function(n, fn) {
    var largs = slice.call(arguments, 2);
    if (largs.length >= n) {
      return fn.apply(this, largs.slice(0, n));
    }
    return function() {
      var args = largs.concat(slice.call(arguments));
      if (args.length < n) {
        return _.ncurry.apply(this, [n, fn].concat(args));
      }
      return fn.apply(this, args.slice(0, n));
    };
  };
  _.partial = function(f) {
    var args = slice.call(arguments, 1);
    return function() {
      return f.apply(this, args.concat(slice.call(arguments)));
    };
  };
  _.flip = _.curry(function(fn, x, y) {
    return fn(y, x);
  });
  _.compose = function() {
    var fns = slice.call(arguments).reverse();
    return _.seq.apply(null, fns);
  };
  _.seq = function() {
    var fns = slice.call(arguments);
    return function() {
      if (!fns.length) {
        return ;
      }
      var r = fns[0].apply(this, arguments);
      for (var i = 1; i < fns.length; i++) {
        r = fns[i].call(this, r);
      }
      return r;
    };
  };
  function Stream(xs, ee, mappingHint) {
    if (xs && _.isStream(xs)) {
      return xs;
    }
    EventEmitter.call(this);
    var self = this;
    self.__HighlandStream__ = true;
    self.id = ('' + Math.random()).substr(2, 6);
    this.paused = true;
    this._incoming = [];
    this._outgoing = [];
    this._consumers = [];
    this._observers = [];
    this._destructors = [];
    this._send_events = false;
    this._delegate = null;
    this.source = null;
    this.writable = true;
    self.on('newListener', function(ev) {
      if (ev === 'data') {
        self._send_events = true;
        _.setImmediate(self.resume.bind(self));
      } else if (ev === 'end') {
        self._send_events = true;
      }
    });
    self.on('removeListener', function(ev) {
      if (ev === 'end' || ev === 'data') {
        var end_listeners = self.listeners('end').length;
        var data_listeners = self.listeners('data').length;
        if (end_listeners + data_listeners === 0) {
          self._send_events = false;
        }
      }
    });
    if (xs === undefined) {} else if (_.isArray(xs)) {
      self._incoming = xs.concat([nil]);
    } else if (typeof xs === 'function') {
      this._generator = xs;
      this._generator_push = function(err, x) {
        self.write(err ? new StreamError(err) : x);
      };
      this._generator_next = function(s) {
        if (s) {
          var _paused = self.paused;
          if (!_paused) {
            self.pause();
          }
          self.write(new StreamRedirect(s));
          if (!_paused) {
            self.resume();
          }
        } else {
          self._generator_running = false;
        }
        if (!self.paused) {
          self.resume();
        }
      };
    } else if (_.isObject(xs)) {
      if (_.isFunction(xs.then)) {
        return _(function(push) {
          xs.then(function(value) {
            push(null, value);
            return push(null, nil);
          }, function(err) {
            push(err);
            return push(null, nil);
          });
        });
      } else {
        xs.on('error', function(err) {
          self.write(new StreamError(err));
        });
        xs.pipe(self);
      }
    } else if (typeof xs === 'string') {
      var mappingHintType = (typeof mappingHint);
      var mapper;
      if (mappingHintType === 'function') {
        mapper = mappingHint;
      } else if (mappingHintType === 'number') {
        mapper = function() {
          return slice.call(arguments, 0, mappingHint);
        };
      } else if (_.isArray(mappingHint)) {
        mapper = function() {
          var args = arguments;
          return mappingHint.reduce(function(ctx, hint, idx) {
            ctx[hint] = args[idx];
            return ctx;
          }, {});
        };
      } else {
        mapper = function(x) {
          return x;
        };
      }
      ee.on(xs, function() {
        var ctx = mapper.apply(this, arguments);
        self.write(ctx);
      });
    } else {
      throw new Error('Unexpected argument type to Stream(): ' + (typeof xs));
    }
  }
  inherits(Stream, EventEmitter);
  function exposeMethod(name) {
    var f = Stream.prototype[name];
    var n = f.length;
    _[name] = _.ncurry(n + 1, function() {
      var args = Array.prototype.slice.call(arguments);
      var s = _(args.pop());
      return f.apply(s, args);
    });
  }
  function StreamError(err) {
    this.__HighlandStreamError__ = true;
    this.error = err;
  }
  function StreamRedirect(to) {
    this.__HighlandStreamRedirect__ = true;
    this.to = to;
  }
  _.isStream = function(x) {
    return _.isObject(x) && x.__HighlandStream__;
  };
  _._isStreamError = function(x) {
    return _.isObject(x) && x.__HighlandStreamError__;
  };
  _._isStreamRedirect = function(x) {
    return _.isObject(x) && x.__HighlandStreamRedirect__;
  };
  Stream.prototype._send = function(err, x) {
    if (x === nil) {
      this.ended = true;
    }
    if (this._consumers.length) {
      for (var i = 0,
          len = this._consumers.length; i < len; i++) {
        var c = this._consumers[i];
        if (err) {
          c.write(new StreamError(err));
        } else {
          c.write(x);
        }
      }
    }
    if (this._observers.length) {
      for (var j = 0,
          len2 = this._observers.length; j < len2; j++) {
        this._observers[j].write(x);
      }
    }
    if (this._send_events) {
      if (x === nil) {
        this.emit('end');
      } else {
        this.emit('data', x);
      }
    }
  };
  Stream.prototype.pause = function() {
    this.paused = true;
    if (this.source) {
      this.source._checkBackPressure();
    }
  };
  Stream.prototype._checkBackPressure = function() {
    if (!this._consumers.length) {
      return this.pause();
    }
    for (var i = 0,
        len = this._consumers.length; i < len; i++) {
      if (this._consumers[i].paused) {
        return this.pause();
      }
    }
    return this.resume();
  };
  Stream.prototype._readFromBuffer = function() {
    var len = this._incoming.length;
    var i = 0;
    while (i < len && !this.paused) {
      var x = this._incoming[i];
      if (_._isStreamError(x)) {
        this._send(x.error);
      } else if (_._isStreamRedirect(x)) {
        this._redirect(x.to);
      } else {
        this._send(null, x);
      }
      i++;
    }
    this._incoming.splice(0, i);
  };
  Stream.prototype._sendOutgoing = function() {
    var len = this._outgoing.length;
    var i = 0;
    while (i < len && !this.paused) {
      var x = this._outgoing[i];
      if (_._isStreamError(x)) {
        Stream.prototype._send.call(this, x.error);
      } else if (_._isStreamRedirect(x)) {
        this._redirect(x.to);
      } else {
        Stream.prototype._send.call(this, null, x);
      }
      i++;
    }
    this._outgoing.splice(0, i);
  };
  Stream.prototype.resume = function() {
    if (this._resume_running) {
      this._repeat_resume = true;
      return ;
    }
    this._resume_running = true;
    do {
      this._repeat_resume = false;
      this.paused = false;
      this._sendOutgoing();
      this._readFromBuffer();
      if (!this.paused) {
        if (this.source) {
          this.source._checkBackPressure();
        } else if (this._generator) {
          this._runGenerator();
        } else {
          this.emit('drain');
        }
      }
    } while (this._repeat_resume);
    this._resume_running = false;
  };
  Stream.prototype.end = function() {
    this.write(nil);
  };
  Stream.prototype.pipe = function(dest) {
    var self = this;
    var canClose = dest !== process.stdout && dest !== process.stderr;
    var s = self.consume(function(err, x, push, next) {
      if (err) {
        self.emit('error', err);
        return ;
      }
      if (x === nil) {
        if (canClose) {
          dest.end();
        }
      } else if (dest.write(x) !== false) {
        next();
      }
    });
    dest.on('drain', onConsumerDrain);
    this._destructors.push(function() {
      dest.removeListener('drain', onConsumerDrain);
    });
    s.resume();
    return dest;
    function onConsumerDrain() {
      s.resume();
    }
  };
  Stream.prototype.destroy = function() {
    var self = this;
    this.end();
    _(this._consumers).each(function(consumer) {
      self._removeConsumer(consumer);
    });
    if (this.source) {
      this.source._removeConsumer(this);
    }
    _(this._destructors).each(function(destructor) {
      destructor();
    });
  };
  Stream.prototype._runGenerator = function() {
    if (this._generator_running) {
      return ;
    }
    this._generator_running = true;
    this._generator(this._generator_push, this._generator_next);
  };
  Stream.prototype._redirect = function(to) {
    to = _(to);
    while (to._delegate) {
      to = to._delegate;
    }
    to._consumers = this._consumers.map(function(c) {
      c.source = to;
      return c;
    });
    this._consumers = [];
    to._delegate_source = this._delegate_source || this;
    to._delegate_source._delegate = to;
    if (this.paused) {
      to.pause();
    } else {
      this.pause();
      to._checkBackPressure();
    }
  };
  Stream.prototype._addConsumer = function(s) {
    if (this._consumers.length) {
      throw new Error('Stream already being consumed, you must either fork() or observe()');
    }
    s.source = this;
    this._consumers.push(s);
    this._checkBackPressure();
  };
  Stream.prototype._removeConsumer = function(s) {
    var src = this;
    while (src._delegate) {
      src = src._delegate;
    }
    src._consumers = src._consumers.filter(function(c) {
      return c !== s;
    });
    if (s.source === src) {
      s.source = null;
    }
    src._checkBackPressure();
  };
  Stream.prototype.consume = function(f) {
    var self = this;
    while (self._delegate) {
      self = self._delegate;
    }
    var s = new Stream();
    var _send = s._send;
    var push = function(err, x) {
      if (x === nil) {
        self._removeConsumer(s);
      }
      if (s.paused) {
        if (err) {
          s._outgoing.push(new StreamError(err));
        } else {
          s._outgoing.push(x);
        }
      } else {
        _send.call(s, err, x);
      }
    };
    var async;
    var next_called;
    var next = function(s2) {
      if (s2) {
        var _paused = s.paused;
        if (!_paused) {
          s.pause();
        }
        s.write(new StreamRedirect(s2));
        if (!_paused) {
          s.resume();
        }
      } else if (async) {
        s.resume();
      } else {
        next_called = true;
      }
    };
    s._send = function(err, x) {
      async = false;
      next_called = false;
      f(err, x, push, next);
      async = true;
      if (!next_called) {
        s.pause();
      }
    };
    self._addConsumer(s);
    return s;
  };
  exposeMethod('consume');
  Stream.prototype.pull = function(f) {
    var s = this.consume(function(err, x) {
      s.source._removeConsumer(s);
      f(err, x);
    });
    s.id = 'pull:' + s.id;
    s.resume();
  };
  Stream.prototype.write = function(x) {
    if (this.paused) {
      this._incoming.push(x);
    } else {
      if (_._isStreamError(x)) {
        this._send(x.error);
      } else {
        this._send(null, x);
      }
    }
    return !this.paused;
  };
  Stream.prototype.fork = function() {
    var s = new Stream();
    s.id = 'fork:' + s.id;
    s.source = this;
    this._consumers.push(s);
    this._checkBackPressure();
    return s;
  };
  Stream.prototype.observe = function() {
    var s = new Stream();
    s.id = 'observe:' + s.id;
    s.source = this;
    this._observers.push(s);
    return s;
  };
  Stream.prototype.errors = function(f) {
    return this.consume(function(err, x, push, next) {
      if (err) {
        f(err, push);
        next();
      } else if (x === nil) {
        push(null, nil);
      } else {
        push(null, x);
        next();
      }
    });
  };
  exposeMethod('errors');
  Stream.prototype.stopOnError = function(f) {
    return this.consume(function(err, x, push, next) {
      if (err) {
        f(err, push);
        push(null, nil);
      } else if (x === nil) {
        push(null, nil);
      } else {
        push(null, x);
        next();
      }
    });
  };
  exposeMethod('stopOnError');
  Stream.prototype.each = function(f) {
    var self = this;
    return this.consume(function(err, x, push, next) {
      if (err) {
        self.emit('error', err);
      } else if (x !== nil) {
        f(x);
        next();
      }
    }).resume();
  };
  exposeMethod('each');
  Stream.prototype.apply = function(f) {
    return this.toArray(function(args) {
      f.apply(null, args);
    });
  };
  exposeMethod('apply');
  Stream.prototype.toArray = function(f) {
    var self = this;
    var xs = [];
    var s = this.consume(function(err, x, push, next) {
      if (err) {
        self.emit('error', err);
      } else if (x === nil) {
        f(xs);
      } else {
        xs.push(x);
        next();
      }
    });
    s.id = 'toArray:' + s.id;
    s.resume();
  };
  Stream.prototype.map = function(f) {
    if (!_.isFunction(f)) {
      var val = f;
      f = function() {
        return val;
      };
    }
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        push(err, x);
      } else {
        var fnVal,
            fnErr;
        try {
          fnVal = f(x);
        } catch (e) {
          fnErr = e;
        }
        push(fnErr, fnVal);
        next();
      }
    });
  };
  exposeMethod('map');
  Stream.prototype.doto = function(f) {
    return this.map(function(x) {
      f(x);
      return x;
    });
  };
  exposeMethod('doto');
  Stream.prototype.ratelimit = function(num, ms) {
    if (num < 1) {
      throw new Error('Invalid number of operations per ms: ' + num);
    }
    var sent = 0;
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        push(null, nil);
      } else {
        if (sent < num) {
          sent++;
          push(null, x);
          next();
        } else {
          setTimeout(function() {
            sent = 1;
            push(null, x);
            next();
          }, ms);
        }
      }
    });
  };
  exposeMethod('ratelimit');
  Stream.prototype.flatMap = function(f) {
    return this.map(f).sequence();
  };
  exposeMethod('flatMap');
  Stream.prototype.pluck = function(prop) {
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        push(err, x);
      } else if (_.isObject(x)) {
        push(null, x[prop]);
        next();
      } else {
        push(new Error('Expected Object, got ' + (typeof x)));
        next();
      }
    });
  };
  exposeMethod('pluck');
  Stream.prototype.filter = function(f) {
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        push(err, x);
      } else {
        var fnVal,
            fnErr;
        try {
          fnVal = f(x);
        } catch (e) {
          fnErr = e;
        }
        if (fnErr) {
          push(fnErr);
        } else if (fnVal) {
          push(null, x);
        }
        next();
      }
    });
  };
  exposeMethod('filter');
  Stream.prototype.flatFilter = function(f) {
    return this.flatMap(function(x) {
      return f(x).take(1).otherwise(errorStream()).flatMap(function(bool) {
        return _(bool ? [x] : []);
      });
    });
    function errorStream() {
      return _(function(push) {
        push(new Error('Stream returned by function was empty.'));
        push(null, _.nil);
      });
    }
  };
  exposeMethod('flatFilter');
  Stream.prototype.reject = function(f) {
    return this.filter(_.compose(_.not, f));
  };
  exposeMethod('reject');
  Stream.prototype.find = function(f) {
    return this.filter(f).take(1);
  };
  exposeMethod('find');
  Stream.prototype.group = function(f) {
    var lambda = _.isString(f) ? _.get(f) : f;
    return this.reduce({}, function(m, o) {
      var key = lambda(o);
      if (!m.hasOwnProperty(key)) {
        m[key] = [];
      }
      m[key].push(o);
      return m;
    }.bind(this));
  };
  exposeMethod('group');
  Stream.prototype.compact = function() {
    return this.filter(function(x) {
      return x;
    });
  };
  exposeMethod('compact');
  Stream.prototype.where = function(props) {
    return this.filter(function(x) {
      for (var k in props) {
        if (x[k] !== props[k]) {
          return false;
        }
      }
      return true;
    });
  };
  exposeMethod('where');
  Stream.prototype.zip = function(ys) {
    ys = _(ys);
    var xs = this;
    var returned = 0;
    var z = [];
    function nextValue(index, max, src, push, next) {
      src.pull(function(err, x) {
        if (err) {
          push(err);
          nextValue(index, max, src, push, next);
        } else if (x === _.nil) {
          push(null, nil);
        } else {
          returned++;
          z[index] = x;
          if (returned === max) {
            push(null, z);
            next();
          }
        }
      });
    }
    return _(function(push, next) {
      returned = 0;
      z = [];
      nextValue(0, 2, xs, push, next);
      nextValue(1, 2, ys, push, next);
    });
  };
  exposeMethod('zip');
  Stream.prototype.batch = function(n) {
    var batched = [];
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      }
      if (x === nil) {
        if (batched.length > 0) {
          push(null, batched);
        }
        push(null, nil);
      } else {
        batched.push(x);
        if (batched.length === n) {
          push(null, batched);
          batched = [];
        }
        next();
      }
    });
  };
  exposeMethod('batch');
  Stream.prototype.take = function(n) {
    if (n === 0) {
      return _([]);
    }
    var s = this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        if (n > 0) {
          next();
        } else {
          push(null, nil);
        }
      } else if (x === nil) {
        push(null, nil);
      } else {
        n--;
        push(null, x);
        if (n > 0) {
          next();
        } else {
          push(null, nil);
        }
      }
    });
    s.id = 'take:' + s.id;
    return s;
  };
  exposeMethod('take');
  Stream.prototype.head = function() {
    return this.take(1);
  };
  exposeMethod('head');
  Stream.prototype.last = function() {
    var nothing = {};
    var prev = nothing;
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        if (prev !== nothing) {
          push(null, prev);
        }
        push(null, nil);
      } else {
        prev = x;
        next();
      }
    });
  };
  exposeMethod('last');
  Stream.prototype.through = function(target) {
    if (_.isFunction(target)) {
      return target(this);
    } else {
      var output = _();
      target.pause();
      this.pipe(target).pipe(output);
      return output;
    }
  };
  exposeMethod('through');
  _.pipeline = function() {
    if (!arguments.length) {
      return _();
    }
    var start = arguments[0],
        rest;
    if (!_.isStream(start) && !_.isFunction(start.resume)) {
      start = _();
      rest = slice.call(arguments);
    } else {
      start = _(start);
      rest = slice.call(arguments, 1);
    }
    var end = rest.reduce(function(src, dest) {
      return src.through(dest);
    }, start);
    var wrapper = _(function(push, next) {
      end.pull(function(err, x) {
        if (err) {
          wrapper._send(err);
          next();
        } else if (x === nil) {
          wrapper._send(null, nil);
        } else {
          wrapper._send(null, x);
          next();
        }
      });
    });
    wrapper.write = function(x) {
      start.write(x);
    };
    return wrapper;
  };
  Stream.prototype.sequence = function() {
    var original = this;
    var curr = this;
    return _(function(push, next) {
      curr.pull(function(err, x) {
        if (err) {
          push(err);
          return next();
        } else if (_.isArray(x)) {
          if (onOriginalStream()) {
            x.forEach(function(y) {
              push(null, y);
            });
          } else {
            push(null, x);
          }
          return next();
        } else if (_.isStream(x)) {
          if (onOriginalStream()) {
            curr = x;
            return next();
          } else {
            push(null, x);
            return next();
          }
        } else if (x === nil) {
          if (onOriginalStream()) {
            push(null, nil);
          } else {
            curr = original;
            return next();
          }
        } else {
          if (onOriginalStream()) {
            push(new Error('Expected Stream, got ' + (typeof x)));
            return next();
          } else {
            push(null, x);
            return next();
          }
        }
      });
    });
    function onOriginalStream() {
      return curr === original;
    }
  };
  exposeMethod('sequence');
  Stream.prototype.series = Stream.prototype.sequence;
  _.series = _.sequence;
  Stream.prototype.flatten = function() {
    var curr = this;
    var stack = [];
    return _(function(push, next) {
      curr.pull(function(err, x) {
        if (err) {
          push(err);
          return next();
        }
        if (_.isArray(x)) {
          x = _(x);
        }
        if (_.isStream(x)) {
          stack.push(curr);
          curr = x;
          next();
        } else if (x === nil) {
          if (stack.length) {
            curr = stack.pop();
            next();
          } else {
            push(null, nil);
          }
        } else {
          push(null, x);
          next();
        }
      });
    });
  };
  exposeMethod('flatten');
  Stream.prototype.parallel = function(n) {
    var source = this;
    var running = [];
    var ended = false;
    var reading_source = false;
    return _(function(push, next) {
      if (running.length && running[0].buffer.length) {
        var buf = running[0].buffer;
        for (var i = 0; i < buf.length; i++) {
          if (buf[i][1] === nil) {
            running.shift();
            return next();
          } else {
            push.apply(null, buf[i]);
          }
        }
      } else if (running.length < n && !ended && !reading_source) {
        reading_source = true;
        source.pull(function(err, x) {
          reading_source = false;
          if (err) {
            push(err);
          } else if (x === nil) {
            ended = true;
          } else {
            var run = {
              stream: x,
              buffer: []
            };
            running.push(run);
            x.consume(function(err, y, _push, _next) {
              if (running[0] === run) {
                if (y === nil) {
                  running.shift();
                  next();
                } else {
                  push(err, y);
                }
              } else {
                run.buffer.push([err, y]);
              }
              if (y !== nil) {
                _next();
              }
            }).resume();
          }
          return next();
        });
      } else if (!running.length && ended) {
        push(null, nil);
      } else {}
    });
  };
  exposeMethod('parallel');
  Stream.prototype.otherwise = function(ys) {
    var xs = this;
    return xs.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      }
      if (x === nil) {
        next(ys);
      } else {
        push(null, x);
        next(xs);
      }
    });
  };
  exposeMethod('otherwise');
  Stream.prototype.append = function(y) {
    return this.consume(function(err, x, push, next) {
      if (x === nil) {
        push(null, y);
        push(null, _.nil);
      } else {
        push(err, x);
        next();
      }
    });
  };
  exposeMethod('append');
  Stream.prototype.reduce = function(z, f) {
    return this.consume(function(err, x, push, next) {
      if (x === nil) {
        push(null, z);
        push(null, _.nil);
      } else if (err) {
        push(err);
        next();
      } else {
        try {
          z = f(z, x);
        } catch (e) {
          push(e);
          push(null, _.nil);
          return ;
        }
        next();
      }
    });
  };
  exposeMethod('reduce');
  Stream.prototype.reduce1 = function(f) {
    var self = this;
    return _(function(push, next) {
      self.pull(function(err, x) {
        if (err) {
          push(err);
          next();
        }
        if (x === nil) {
          push(null, nil);
        } else {
          next(self.reduce(x, f));
        }
      });
    });
  };
  exposeMethod('reduce1');
  Stream.prototype.collect = function() {
    var xs = [];
    return this.consume(function(err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === nil) {
        push(null, xs);
        push(null, nil);
      } else {
        xs.push(x);
        next();
      }
    });
  };
  exposeMethod('collect');
  Stream.prototype.scan = function(z, f) {
    var self = this;
    return _([z]).concat(self.consume(function(err, x, push, next) {
      if (x === nil) {
        push(null, _.nil);
      } else if (err) {
        push(err);
        next();
      } else {
        try {
          z = f(z, x);
        } catch (e) {
          push(e);
          push(null, _.nil);
          return ;
        }
        push(null, z);
        next();
      }
    }));
  };
  exposeMethod('scan');
  Stream.prototype.scan1 = function(f) {
    var self = this;
    return _(function(push, next) {
      self.pull(function(err, x) {
        if (err) {
          push(err);
          next();
        }
        if (x === nil) {
          push(null, nil);
        } else {
          next(self.scan(x, f));
        }
      });
    });
  };
  exposeMethod('scan1');
  Stream.prototype.concat = function(ys) {
    ys = _(ys);
    return this.consume(function(err, x, push, next) {
      if (x === nil) {
        next(ys);
      } else {
        push(err, x);
        next();
      }
    });
  };
  exposeMethod('concat');
  Stream.prototype.merge = function() {
    var self = this;
    var resuming = false;
    var go_next = false;
    var srcs;
    return _(function(push, next) {
      var safeNext = function() {
        if (!resuming) {
          next();
        } else {
          go_next = true;
        }
      };
      if (!srcs) {
        self.errors(push).toArray(function(xs) {
          srcs = xs;
          srcs.forEach(function(src) {
            src.on('end', function() {
              srcs = srcs.filter(function(s) {
                return s !== src;
              });
              safeNext();
            });
            src.on('data', function(x) {
              src.pause();
              push(null, x);
              safeNext();
            });
            src.on('error', function(err) {
              push(err);
              safeNext();
            });
          });
          next();
        });
      } else if (srcs.length === 0) {
        push(null, nil);
      } else {
        go_next = false;
        resuming = true;
        srcs.forEach(function(src) {
          src.resume();
        });
        resuming = false;
        if (go_next) {
          next();
        }
      }
    });
  };
  exposeMethod('merge');
  Stream.prototype.invoke = function(method, args) {
    return this.map(function(x) {
      return x[method].apply(x, args);
    });
  };
  exposeMethod('invoke');
  Stream.prototype.throttle = function(ms) {
    var s = new Stream();
    var last = 0 - ms;
    var _write = s.write;
    s.write = function(x) {
      var now = new Date().getTime();
      if (_._isStreamError(x) || x === nil) {
        return _write.apply(this, arguments);
      } else if (now - ms >= last) {
        last = now;
        return _write.apply(this, arguments);
      }
    };
    this._addConsumer(s);
    return s;
  };
  exposeMethod('throttle');
  Stream.prototype.debounce = function(ms) {
    var s = new Stream();
    var t = null;
    var nothing = {};
    var last = nothing;
    var _write = s.write;
    s.write = function(x) {
      if (_._isStreamError(x)) {
        return _write.apply(this, arguments);
      } else if (x === nil) {
        if (t) {
          clearTimeout(t);
        }
        if (last !== nothing) {
          _write.call(s, last);
        }
        return _write.apply(this, arguments);
      } else {
        last = x;
        if (t) {
          clearTimeout(t);
        }
        t = setTimeout(function() {
          _write.call(s, last);
        }, ms);
        return !this.paused;
      }
    };
    this._addConsumer(s);
    return s;
  };
  exposeMethod('debounce');
  Stream.prototype.latest = function() {
    var s = new Stream();
    var _write = s.write;
    s.pause = function() {
      this.paused = true;
    };
    s.write = function(x) {
      if (_._isStreamError(x)) {
        _write.call(this, x);
      } else if (x === nil) {
        _write.call(this, x);
      } else {
        if (this.paused) {
          this._incoming = this._incoming.filter(function(x) {
            return _._isStreamError(x) || x === nil;
          });
          this._incoming.push(x);
        } else {
          _write.call(this, x);
        }
      }
      return true;
    };
    this._addConsumer(s);
    s.resume();
    return s;
  };
  exposeMethod('latest');
  _.values = function(obj) {
    return _.keys(obj).map(function(k) {
      return obj[k];
    });
  };
  _.keys = function(obj) {
    var keys = [];
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) {
        keys.push(k);
      }
    }
    return _(keys);
  };
  _.pairs = function(obj) {
    return _.keys(obj).map(function(k) {
      return [k, obj[k]];
    });
  };
  _.extend = _.curry(function(extensions, target) {
    for (var k in extensions) {
      if (extensions.hasOwnProperty(k)) {
        target[k] = extensions[k];
      }
    }
    return target;
  });
  _.get = _.curry(function(prop, obj) {
    return obj[prop];
  });
  _.set = _.curry(function(prop, val, obj) {
    obj[prop] = val;
    return obj;
  });
  _.log = function() {
    console.log.apply(console, arguments);
  };
  _.wrapCallback = function(f) {
    return function() {
      var args = slice.call(arguments);
      return _(function(push) {
        var cb = function(err, x) {
          if (err) {
            push(err);
          } else {
            push(null, x);
          }
          push(null, nil);
        };
        f.apply(null, args.concat([cb]));
      });
    };
  };
  _.add = _.curry(function(a, b) {
    return a + b;
  });
  _.not = function(x) {
    return !x;
  };
})(require("process"));
