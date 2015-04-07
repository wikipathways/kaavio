/* */ 
(function(process) {
  (function(window) {
    var QUnit,
        config,
        onErrorFnPrev,
        fileName = (sourceFromStacktrace(0) || "").replace(/(:\d+)+\)?/, "").replace(/.+\//, ""),
        toString = Object.prototype.toString,
        hasOwn = Object.prototype.hasOwnProperty,
        Date = window.Date,
        now = Date.now || function() {
          return new Date().getTime();
        },
        setTimeout = window.setTimeout,
        clearTimeout = window.clearTimeout,
        defined = {
          document: typeof window.document !== "undefined",
          setTimeout: typeof window.setTimeout !== "undefined",
          sessionStorage: (function() {
            var x = "qunit-test-string";
            try {
              sessionStorage.setItem(x, x);
              sessionStorage.removeItem(x);
              return true;
            } catch (e) {
              return false;
            }
          }())
        },
        errorString = function(error) {
          var name,
              message,
              errorString = error.toString();
          if (errorString.substring(0, 7) === "[object") {
            name = error.name ? error.name.toString() : "Error";
            message = error.message ? error.message.toString() : "";
            if (name && message) {
              return name + ": " + message;
            } else if (name) {
              return name;
            } else if (message) {
              return message;
            } else {
              return "Error";
            }
          } else {
            return errorString;
          }
        },
        objectValues = function(obj) {
          var key,
              val,
              vals = QUnit.is("array", obj) ? [] : {};
          for (key in obj) {
            if (hasOwn.call(obj, key)) {
              val = obj[key];
              vals[key] = val === Object(val) ? objectValues(val) : val;
            }
          }
          return vals;
        };
    QUnit = {
      module: function(name, testEnvironment) {
        config.currentModule = name;
        config.currentModuleTestEnvironment = testEnvironment;
        config.modules[name] = true;
      },
      asyncTest: function(testName, expected, callback) {
        if (arguments.length === 2) {
          callback = expected;
          expected = null;
        }
        QUnit.test(testName, expected, callback, true);
      },
      test: function(testName, expected, callback, async) {
        var test;
        if (arguments.length === 2) {
          callback = expected;
          expected = null;
        }
        test = new Test({
          testName: testName,
          expected: expected,
          async: async,
          callback: callback,
          module: config.currentModule,
          moduleTestEnvironment: config.currentModuleTestEnvironment,
          stack: sourceFromStacktrace(2)
        });
        if (!validTest(test)) {
          return ;
        }
        test.queue();
      },
      start: function(count) {
        var message;
        if (config.semaphore === undefined) {
          QUnit.begin(function() {
            setTimeout(function() {
              QUnit.start(count);
            });
          });
          return ;
        }
        config.semaphore -= count || 1;
        if (config.semaphore > 0) {
          return ;
        }
        QUnit.config.started = QUnit.config.started || now();
        if (config.semaphore < 0) {
          config.semaphore = 0;
          message = "Called start() while already started (QUnit.config.semaphore was 0 already)";
          if (config.current) {
            QUnit.pushFailure(message, sourceFromStacktrace(2));
          } else {
            throw new Error(message);
          }
          return ;
        }
        if (defined.setTimeout) {
          setTimeout(function() {
            if (config.semaphore > 0) {
              return ;
            }
            if (config.timeout) {
              clearTimeout(config.timeout);
            }
            config.blocking = false;
            process(true);
          }, 13);
        } else {
          config.blocking = false;
          process(true);
        }
      },
      stop: function(count) {
        config.semaphore += count || 1;
        config.blocking = true;
        if (config.testTimeout && defined.setTimeout) {
          clearTimeout(config.timeout);
          config.timeout = setTimeout(function() {
            QUnit.ok(false, "Test timed out");
            config.semaphore = 1;
            QUnit.start();
          }, config.testTimeout);
        }
      }
    };
    (function() {
      function F() {}
      F.prototype = QUnit;
      QUnit = new F();
      QUnit.constructor = F;
    }());
    config = {
      queue: [],
      blocking: true,
      hidepassed: false,
      reorder: true,
      altertitle: true,
      scrolltop: true,
      requireExpects: false,
      urlConfig: [{
        id: "noglobals",
        label: "Check for Globals",
        tooltip: "Enabling this will test if any test introduces new properties on the `window` object. Stored as query-strings."
      }, {
        id: "notrycatch",
        label: "No try-catch",
        tooltip: "Enabling this will run tests outside of a try-catch block. Makes debugging exceptions in IE reasonable. Stored as query-strings."
      }],
      modules: {},
      callbacks: {}
    };
    (function() {
      var i,
          current,
          location = window.location || {
            search: "",
            protocol: "file:"
          },
          params = location.search.slice(1).split("&"),
          length = params.length,
          urlParams = {};
      if (params[0]) {
        for (i = 0; i < length; i++) {
          current = params[i].split("=");
          current[0] = decodeURIComponent(current[0]);
          current[1] = current[1] ? decodeURIComponent(current[1]) : true;
          if (urlParams[current[0]]) {
            urlParams[current[0]] = [].concat(urlParams[current[0]], current[1]);
          } else {
            urlParams[current[0]] = current[1];
          }
        }
      }
      QUnit.urlParams = urlParams;
      config.filter = urlParams.filter;
      config.module = urlParams.module;
      config.testNumber = [];
      if (urlParams.testNumber) {
        urlParams.testNumber = [].concat(urlParams.testNumber);
        for (i = 0; i < urlParams.testNumber.length; i++) {
          current = urlParams.testNumber[i];
          config.testNumber.push(parseInt(current, 10));
        }
      }
      QUnit.isLocal = location.protocol === "file:";
    }());
    extend(QUnit, {
      config: config,
      is: function(type, obj) {
        return QUnit.objectType(obj) === type;
      },
      objectType: function(obj) {
        if (typeof obj === "undefined") {
          return "undefined";
        }
        if (obj === null) {
          return "null";
        }
        var match = toString.call(obj).match(/^\[object\s(.*)\]$/),
            type = match && match[1] || "";
        switch (type) {
          case "Number":
            if (isNaN(obj)) {
              return "nan";
            }
            return "number";
          case "String":
          case "Boolean":
          case "Array":
          case "Date":
          case "RegExp":
          case "Function":
            return type.toLowerCase();
        }
        if (typeof obj === "object") {
          return "object";
        }
        return undefined;
      },
      url: function(params) {
        params = extend(extend({}, QUnit.urlParams), params);
        var key,
            querystring = "?";
        for (key in params) {
          if (hasOwn.call(params, key)) {
            querystring += encodeURIComponent(key) + "=" + encodeURIComponent(params[key]) + "&";
          }
        }
        return window.location.protocol + "//" + window.location.host + window.location.pathname + querystring.slice(0, -1);
      },
      extend: extend
    });
    extend(QUnit.constructor.prototype, {
      begin: registerLoggingCallback("begin"),
      done: registerLoggingCallback("done"),
      log: registerLoggingCallback("log"),
      testStart: registerLoggingCallback("testStart"),
      testDone: registerLoggingCallback("testDone"),
      moduleStart: registerLoggingCallback("moduleStart"),
      moduleDone: registerLoggingCallback("moduleDone")
    });
    QUnit.load = function() {
      runLoggingCallbacks("begin", {totalTests: Test.count});
      extend(config, {
        stats: {
          all: 0,
          bad: 0
        },
        moduleStats: {
          all: 0,
          bad: 0
        },
        started: 0,
        updateRate: 1000,
        autostart: true,
        filter: "",
        semaphore: 1
      }, true);
      config.blocking = false;
      if (config.autostart) {
        QUnit.start();
      }
    };
    onErrorFnPrev = window.onerror;
    window.onerror = function(error, filePath, linerNr) {
      var ret = false;
      if (onErrorFnPrev) {
        ret = onErrorFnPrev(error, filePath, linerNr);
      }
      if (ret !== true) {
        if (QUnit.config.current) {
          if (QUnit.config.current.ignoreGlobalErrors) {
            return true;
          }
          QUnit.pushFailure(error, filePath + ":" + linerNr);
        } else {
          QUnit.test("global failure", extend(function() {
            QUnit.pushFailure(error, filePath + ":" + linerNr);
          }, {validTest: validTest}));
        }
        return false;
      }
      return ret;
    };
    function done() {
      config.autorun = true;
      if (config.previousModule) {
        runLoggingCallbacks("moduleDone", {
          name: config.previousModule,
          failed: config.moduleStats.bad,
          passed: config.moduleStats.all - config.moduleStats.bad,
          total: config.moduleStats.all
        });
      }
      delete config.previousModule;
      var runtime = now() - config.started,
          passed = config.stats.all - config.stats.bad;
      runLoggingCallbacks("done", {
        failed: config.stats.bad,
        passed: passed,
        total: config.stats.all,
        runtime: runtime
      });
    }
    function validTest(test) {
      var include,
          filter = config.filter && config.filter.toLowerCase(),
          module = config.module && config.module.toLowerCase(),
          fullName = (test.module + ": " + test.testName).toLowerCase();
      if (test.callback && test.callback.validTest === validTest) {
        delete test.callback.validTest;
        return true;
      }
      if (config.testNumber.length > 0) {
        if (inArray(test.testNumber, config.testNumber) < 0) {
          return false;
        }
      }
      if (module && (!test.module || test.module.toLowerCase() !== module)) {
        return false;
      }
      if (!filter) {
        return true;
      }
      include = filter.charAt(0) !== "!";
      if (!include) {
        filter = filter.slice(1);
      }
      if (fullName.indexOf(filter) !== -1) {
        return include;
      }
      return !include;
    }
    function extractStacktrace(e, offset) {
      offset = offset === undefined ? 4 : offset;
      var stack,
          include,
          i;
      if (e.stacktrace) {
        return e.stacktrace.split("\n")[offset + 3];
      } else if (e.stack) {
        stack = e.stack.split("\n");
        if (/^error$/i.test(stack[0])) {
          stack.shift();
        }
        if (fileName) {
          include = [];
          for (i = offset; i < stack.length; i++) {
            if (stack[i].indexOf(fileName) !== -1) {
              break;
            }
            include.push(stack[i]);
          }
          if (include.length) {
            return include.join("\n");
          }
        }
        return stack[offset];
      } else if (e.sourceURL) {
        if (/qunit.js$/.test(e.sourceURL)) {
          return ;
        }
        return e.sourceURL + ":" + e.line;
      }
    }
    function sourceFromStacktrace(offset) {
      try {
        throw new Error();
      } catch (e) {
        return extractStacktrace(e, offset);
      }
    }
    function synchronize(callback, last) {
      config.queue.push(callback);
      if (config.autorun && !config.blocking) {
        process(last);
      }
    }
    function process(last) {
      function next() {
        process(last);
      }
      var start = now();
      config.depth = config.depth ? config.depth + 1 : 1;
      while (config.queue.length && !config.blocking) {
        if (!defined.setTimeout || config.updateRate <= 0 || ((now() - start) < config.updateRate)) {
          config.queue.shift()();
        } else {
          setTimeout(next, 13);
          break;
        }
      }
      config.depth--;
      if (last && !config.blocking && !config.queue.length && config.depth === 0) {
        done();
      }
    }
    function saveGlobal() {
      config.pollution = [];
      if (config.noglobals) {
        for (var key in window) {
          if (hasOwn.call(window, key)) {
            if (/^qunit-test-output/.test(key)) {
              continue;
            }
            config.pollution.push(key);
          }
        }
      }
    }
    function checkPollution() {
      var newGlobals,
          deletedGlobals,
          old = config.pollution;
      saveGlobal();
      newGlobals = diff(config.pollution, old);
      if (newGlobals.length > 0) {
        QUnit.pushFailure("Introduced global variable(s): " + newGlobals.join(", "));
      }
      deletedGlobals = diff(old, config.pollution);
      if (deletedGlobals.length > 0) {
        QUnit.pushFailure("Deleted global variable(s): " + deletedGlobals.join(", "));
      }
    }
    function diff(a, b) {
      var i,
          j,
          result = a.slice();
      for (i = 0; i < result.length; i++) {
        for (j = 0; j < b.length; j++) {
          if (result[i] === b[j]) {
            result.splice(i, 1);
            i--;
            break;
          }
        }
      }
      return result;
    }
    function extend(a, b, undefOnly) {
      for (var prop in b) {
        if (hasOwn.call(b, prop)) {
          if (!(prop === "constructor" && a === window)) {
            if (b[prop] === undefined) {
              delete a[prop];
            } else if (!(undefOnly && typeof a[prop] !== "undefined")) {
              a[prop] = b[prop];
            }
          }
        }
      }
      return a;
    }
    function registerLoggingCallback(key) {
      if (QUnit.objectType(config.callbacks[key]) === "undefined") {
        config.callbacks[key] = [];
      }
      return function(callback) {
        config.callbacks[key].push(callback);
      };
    }
    function runLoggingCallbacks(key, args) {
      var i,
          l,
          callbacks;
      callbacks = config.callbacks[key];
      for (i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i](args);
      }
    }
    function inArray(elem, array) {
      if (array.indexOf) {
        return array.indexOf(elem);
      }
      for (var i = 0,
          length = array.length; i < length; i++) {
        if (array[i] === elem) {
          return i;
        }
      }
      return -1;
    }
    function Test(settings) {
      extend(this, settings);
      this.assert = new Assert(this);
      this.assertions = [];
      this.testNumber = ++Test.count;
    }
    Test.count = 0;
    Test.prototype = {
      setup: function() {
        if (this.module !== config.previousModule || !hasOwn.call(config, "previousModule")) {
          if (hasOwn.call(config, "previousModule")) {
            runLoggingCallbacks("moduleDone", {
              name: config.previousModule,
              failed: config.moduleStats.bad,
              passed: config.moduleStats.all - config.moduleStats.bad,
              total: config.moduleStats.all
            });
          }
          config.previousModule = this.module;
          config.moduleStats = {
            all: 0,
            bad: 0
          };
          runLoggingCallbacks("moduleStart", {name: this.module});
        }
        config.current = this;
        this.testEnvironment = extend({
          setup: function() {},
          teardown: function() {}
        }, this.moduleTestEnvironment);
        this.started = now();
        runLoggingCallbacks("testStart", {
          name: this.testName,
          module: this.module,
          testNumber: this.testNumber
        });
        if (!config.pollution) {
          saveGlobal();
        }
        if (config.notrycatch) {
          this.testEnvironment.setup.call(this.testEnvironment, this.assert);
          return ;
        }
        try {
          this.testEnvironment.setup.call(this.testEnvironment, this.assert);
        } catch (e) {
          this.pushFailure("Setup failed on " + this.testName + ": " + (e.message || e), extractStacktrace(e, 0));
        }
      },
      run: function() {
        config.current = this;
        if (this.async) {
          QUnit.stop();
        }
        this.callbackStarted = now();
        if (config.notrycatch) {
          this.callback.call(this.testEnvironment, this.assert);
          this.callbackRuntime = now() - this.callbackStarted;
          return ;
        }
        try {
          this.callback.call(this.testEnvironment, this.assert);
          this.callbackRuntime = now() - this.callbackStarted;
        } catch (e) {
          this.callbackRuntime = now() - this.callbackStarted;
          this.pushFailure("Died on test #" + (this.assertions.length + 1) + " " + this.stack + ": " + (e.message || e), extractStacktrace(e, 0));
          saveGlobal();
          if (config.blocking) {
            QUnit.start();
          }
        }
      },
      teardown: function() {
        config.current = this;
        if (config.notrycatch) {
          if (typeof this.callbackRuntime === "undefined") {
            this.callbackRuntime = now() - this.callbackStarted;
          }
          this.testEnvironment.teardown.call(this.testEnvironment, this.assert);
          return ;
        } else {
          try {
            this.testEnvironment.teardown.call(this.testEnvironment, this.assert);
          } catch (e) {
            this.pushFailure("Teardown failed on " + this.testName + ": " + (e.message || e), extractStacktrace(e, 0));
          }
        }
        checkPollution();
      },
      finish: function() {
        config.current = this;
        if (config.requireExpects && this.expected === null) {
          this.pushFailure("Expected number of assertions to be defined, but expect() was not called.", this.stack);
        } else if (this.expected !== null && this.expected !== this.assertions.length) {
          this.pushFailure("Expected " + this.expected + " assertions, but " + this.assertions.length + " were run", this.stack);
        } else if (this.expected === null && !this.assertions.length) {
          this.pushFailure("Expected at least one assertion, but none were run - call expect(0) to accept zero assertions.", this.stack);
        }
        var i,
            bad = 0;
        this.runtime = now() - this.started;
        config.stats.all += this.assertions.length;
        config.moduleStats.all += this.assertions.length;
        for (i = 0; i < this.assertions.length; i++) {
          if (!this.assertions[i].result) {
            bad++;
            config.stats.bad++;
            config.moduleStats.bad++;
          }
        }
        runLoggingCallbacks("testDone", {
          name: this.testName,
          module: this.module,
          failed: bad,
          passed: this.assertions.length - bad,
          total: this.assertions.length,
          runtime: this.runtime,
          assertions: this.assertions,
          testNumber: this.testNumber,
          duration: this.runtime
        });
        config.current = undefined;
      },
      queue: function() {
        var bad,
            test = this;
        function run() {
          synchronize(function() {
            test.setup();
          });
          synchronize(function() {
            test.run();
          });
          synchronize(function() {
            test.teardown();
          });
          synchronize(function() {
            test.finish();
          });
        }
        bad = QUnit.config.reorder && defined.sessionStorage && +sessionStorage.getItem("qunit-test-" + this.module + "-" + this.testName);
        if (bad) {
          run();
        } else {
          synchronize(run, true);
        }
      },
      push: function(result, actual, expected, message) {
        var source,
            details = {
              module: this.module,
              name: this.testName,
              result: result,
              message: message,
              actual: actual,
              expected: expected,
              testNumber: this.testNumber
            };
        if (!result) {
          source = sourceFromStacktrace();
          if (source) {
            details.source = source;
          }
        }
        runLoggingCallbacks("log", details);
        this.assertions.push({
          result: !!result,
          message: message
        });
      },
      pushFailure: function(message, source, actual) {
        if (!this instanceof Test) {
          throw new Error("pushFailure() assertion outside test context, was " + sourceFromStacktrace(2));
        }
        var details = {
          module: this.module,
          name: this.testName,
          result: false,
          message: message || "error",
          actual: actual || null,
          testNumber: this.testNumber
        };
        if (source) {
          details.source = source;
        }
        runLoggingCallbacks("log", details);
        this.assertions.push({
          result: false,
          message: message
        });
      }
    };
    QUnit.pushFailure = function() {
      if (!QUnit.config.current) {
        throw new Error("pushFailure() assertion outside test context, in " + sourceFromStacktrace(2));
      }
      var currentTest = QUnit.config.current.assert.test;
      return currentTest.pushFailure.apply(currentTest, arguments);
    };
    function Assert(testContext) {
      this.test = testContext;
    }
    QUnit.assert = Assert.prototype = {
      expect: function(asserts) {
        if (arguments.length === 1) {
          this.test.expected = asserts;
        } else {
          return this.test.expected;
        }
      },
      push: function() {
        var assert = this;
        if (!QUnit.config.current) {
          throw new Error("assertion outside test context, in " + sourceFromStacktrace(2));
        }
        if (!(assert instanceof Assert)) {
          assert = QUnit.config.current.assert;
        }
        return assert.test.push.apply(assert.test, arguments);
      },
      ok: function(result, message) {
        message = message || (result ? "okay" : "failed, expected argument to be truthy, was: " + QUnit.dump.parse(result));
        if (!!result) {
          this.push(true, result, true, message);
        } else {
          this.test.pushFailure(message, null, result);
        }
      },
      equal: function(actual, expected, message) {
        this.push(expected == actual, actual, expected, message);
      },
      notEqual: function(actual, expected, message) {
        this.push(expected != actual, actual, expected, message);
      },
      propEqual: function(actual, expected, message) {
        actual = objectValues(actual);
        expected = objectValues(expected);
        this.push(QUnit.equiv(actual, expected), actual, expected, message);
      },
      notPropEqual: function(actual, expected, message) {
        actual = objectValues(actual);
        expected = objectValues(expected);
        this.push(!QUnit.equiv(actual, expected), actual, expected, message);
      },
      deepEqual: function(actual, expected, message) {
        this.push(QUnit.equiv(actual, expected), actual, expected, message);
      },
      notDeepEqual: function(actual, expected, message) {
        this.push(!QUnit.equiv(actual, expected), actual, expected, message);
      },
      strictEqual: function(actual, expected, message) {
        this.push(expected === actual, actual, expected, message);
      },
      notStrictEqual: function(actual, expected, message) {
        this.push(expected !== actual, actual, expected, message);
      },
      "throws": function(block, expected, message) {
        var actual,
            expectedType,
            expectedOutput = expected,
            ok = false;
        if (message == null && typeof expected === "string") {
          message = expected;
          expected = null;
        }
        this.test.ignoreGlobalErrors = true;
        try {
          block.call(this.test.testEnvironment);
        } catch (e) {
          actual = e;
        }
        this.test.ignoreGlobalErrors = false;
        if (actual) {
          expectedType = QUnit.objectType(expected);
          if (!expected) {
            ok = true;
            expectedOutput = null;
          } else if (expectedType === "regexp") {
            ok = expected.test(errorString(actual));
          } else if (expectedType === "string") {
            ok = expected === errorString(actual);
          } else if (expectedType === "function" && actual instanceof expected) {
            ok = true;
          } else if (expectedType === "object") {
            ok = actual instanceof expected.constructor && actual.name === expected.name && actual.message === expected.message;
          } else if (expectedType === "function" && expected.call({}, actual) === true) {
            expectedOutput = null;
            ok = true;
          }
          this.push(ok, actual, expectedOutput, message);
        } else {
          this.test.pushFailure(message, null, "No exception was thrown.");
        }
      }
    };
    QUnit.equiv = (function() {
      function bindCallbacks(o, callbacks, args) {
        var prop = QUnit.objectType(o);
        if (prop) {
          if (QUnit.objectType(callbacks[prop]) === "function") {
            return callbacks[prop].apply(callbacks, args);
          } else {
            return callbacks[prop];
          }
        }
      }
      var innerEquiv,
          callers = [],
          parents = [],
          parentsB = [],
          getProto = Object.getPrototypeOf || function(obj) {
            return obj.__proto__;
          },
          callbacks = (function() {
            function useStrictEquality(b, a) {
              if (b instanceof a.constructor || a instanceof b.constructor) {
                return a == b;
              } else {
                return a === b;
              }
            }
            return {
              "string": useStrictEquality,
              "boolean": useStrictEquality,
              "number": useStrictEquality,
              "null": useStrictEquality,
              "undefined": useStrictEquality,
              "nan": function(b) {
                return isNaN(b);
              },
              "date": function(b, a) {
                return QUnit.objectType(b) === "date" && a.valueOf() === b.valueOf();
              },
              "regexp": function(b, a) {
                return QUnit.objectType(b) === "regexp" && a.source === b.source && a.global === b.global && a.ignoreCase === b.ignoreCase && a.multiline === b.multiline && a.sticky === b.sticky;
              },
              "function": function() {
                var caller = callers[callers.length - 1];
                return caller !== Object && typeof caller !== "undefined";
              },
              "array": function(b, a) {
                var i,
                    j,
                    len,
                    loop,
                    aCircular,
                    bCircular;
                if (QUnit.objectType(b) !== "array") {
                  return false;
                }
                len = a.length;
                if (len !== b.length) {
                  return false;
                }
                parents.push(a);
                parentsB.push(b);
                for (i = 0; i < len; i++) {
                  loop = false;
                  for (j = 0; j < parents.length; j++) {
                    aCircular = parents[j] === a[i];
                    bCircular = parentsB[j] === b[i];
                    if (aCircular || bCircular) {
                      if (a[i] === b[i] || aCircular && bCircular) {
                        loop = true;
                      } else {
                        parents.pop();
                        parentsB.pop();
                        return false;
                      }
                    }
                  }
                  if (!loop && !innerEquiv(a[i], b[i])) {
                    parents.pop();
                    parentsB.pop();
                    return false;
                  }
                }
                parents.pop();
                parentsB.pop();
                return true;
              },
              "object": function(b, a) {
                var i,
                    j,
                    loop,
                    aCircular,
                    bCircular,
                    eq = true,
                    aProperties = [],
                    bProperties = [];
                if (a.constructor !== b.constructor) {
                  if (!((getProto(a) === null && getProto(b) === Object.prototype) || (getProto(b) === null && getProto(a) === Object.prototype))) {
                    return false;
                  }
                }
                callers.push(a.constructor);
                parents.push(a);
                parentsB.push(b);
                for (i in a) {
                  loop = false;
                  for (j = 0; j < parents.length; j++) {
                    aCircular = parents[j] === a[i];
                    bCircular = parentsB[j] === b[i];
                    if (aCircular || bCircular) {
                      if (a[i] === b[i] || aCircular && bCircular) {
                        loop = true;
                      } else {
                        eq = false;
                        break;
                      }
                    }
                  }
                  aProperties.push(i);
                  if (!loop && !innerEquiv(a[i], b[i])) {
                    eq = false;
                    break;
                  }
                }
                parents.pop();
                parentsB.pop();
                callers.pop();
                for (i in b) {
                  bProperties.push(i);
                }
                return eq && innerEquiv(aProperties.sort(), bProperties.sort());
              }
            };
          }());
      innerEquiv = function() {
        var args = [].slice.apply(arguments);
        if (args.length < 2) {
          return true;
        }
        return ((function(a, b) {
          if (a === b) {
            return true;
          } else if (a === null || b === null || typeof a === "undefined" || typeof b === "undefined" || QUnit.objectType(a) !== QUnit.objectType(b)) {
            return false;
          } else {
            return bindCallbacks(a, callbacks, [b, a]);
          }
        }(args[0], args[1])) && innerEquiv.apply(this, args.splice(1, args.length - 1)));
      };
      return innerEquiv;
    }());
    QUnit.dump = (function() {
      function quote(str) {
        return "\"" + str.toString().replace(/"/g, "\\\"") + "\"";
      }
      function literal(o) {
        return o + "";
      }
      function join(pre, arr, post) {
        var s = dump.separator(),
            base = dump.indent(),
            inner = dump.indent(1);
        if (arr.join) {
          arr = arr.join("," + s + inner);
        }
        if (!arr) {
          return pre + post;
        }
        return [pre, inner + arr, base + post].join(s);
      }
      function array(arr, stack) {
        var i = arr.length,
            ret = new Array(i);
        this.up();
        while (i--) {
          ret[i] = this.parse(arr[i], undefined, stack);
        }
        this.down();
        return join("[", ret, "]");
      }
      var reName = /^function (\w+)/,
          dump = {
            parse: function(obj, type, stack) {
              stack = stack || [];
              var inStack,
                  res,
                  parser = this.parsers[type || this.typeOf(obj)];
              type = typeof parser;
              inStack = inArray(obj, stack);
              if (inStack !== -1) {
                return "recursion(" + (inStack - stack.length) + ")";
              }
              if (type === "function") {
                stack.push(obj);
                res = parser.call(this, obj, stack);
                stack.pop();
                return res;
              }
              return (type === "string") ? parser : this.parsers.error;
            },
            typeOf: function(obj) {
              var type;
              if (obj === null) {
                type = "null";
              } else if (typeof obj === "undefined") {
                type = "undefined";
              } else if (QUnit.is("regexp", obj)) {
                type = "regexp";
              } else if (QUnit.is("date", obj)) {
                type = "date";
              } else if (QUnit.is("function", obj)) {
                type = "function";
              } else if (typeof obj.setInterval !== undefined && typeof obj.document !== "undefined" && typeof obj.nodeType === "undefined") {
                type = "window";
              } else if (obj.nodeType === 9) {
                type = "document";
              } else if (obj.nodeType) {
                type = "node";
              } else if (toString.call(obj) === "[object Array]" || (typeof obj.length === "number" && typeof obj.item !== "undefined" && (obj.length ? obj.item(0) === obj[0] : (obj.item(0) === null && typeof obj[0] === "undefined")))) {
                type = "array";
              } else if (obj.constructor === Error.prototype.constructor) {
                type = "error";
              } else {
                type = typeof obj;
              }
              return type;
            },
            separator: function() {
              return this.multiline ? this.HTML ? "<br />" : "\n" : this.HTML ? "&nbsp;" : " ";
            },
            indent: function(extra) {
              if (!this.multiline) {
                return "";
              }
              var chr = this.indentChar;
              if (this.HTML) {
                chr = chr.replace(/\t/g, "   ").replace(/ /g, "&nbsp;");
              }
              return new Array(this.depth + (extra || 0)).join(chr);
            },
            up: function(a) {
              this.depth += a || 1;
            },
            down: function(a) {
              this.depth -= a || 1;
            },
            setParser: function(name, parser) {
              this.parsers[name] = parser;
            },
            quote: quote,
            literal: literal,
            join: join,
            depth: 1,
            parsers: {
              window: "[Window]",
              document: "[Document]",
              error: function(error) {
                return "Error(\"" + error.message + "\")";
              },
              unknown: "[Unknown]",
              "null": "null",
              "undefined": "undefined",
              "function": function(fn) {
                var ret = "function",
                    name = "name" in fn ? fn.name : (reName.exec(fn) || [])[1];
                if (name) {
                  ret += " " + name;
                }
                ret += "( ";
                ret = [ret, dump.parse(fn, "functionArgs"), "){"].join("");
                return join(ret, dump.parse(fn, "functionCode"), "}");
              },
              array: array,
              nodelist: array,
              "arguments": array,
              object: function(map, stack) {
                var ret = [],
                    keys,
                    key,
                    val,
                    i,
                    nonEnumerableProperties;
                dump.up();
                keys = [];
                for (key in map) {
                  keys.push(key);
                }
                nonEnumerableProperties = ["message", "name"];
                for (i in nonEnumerableProperties) {
                  key = nonEnumerableProperties[i];
                  if (key in map && !(key in keys)) {
                    keys.push(key);
                  }
                }
                keys.sort();
                for (i = 0; i < keys.length; i++) {
                  key = keys[i];
                  val = map[key];
                  ret.push(dump.parse(key, "key") + ": " + dump.parse(val, undefined, stack));
                }
                dump.down();
                return join("{", ret, "}");
              },
              node: function(node) {
                var len,
                    i,
                    val,
                    open = dump.HTML ? "&lt;" : "<",
                    close = dump.HTML ? "&gt;" : ">",
                    tag = node.nodeName.toLowerCase(),
                    ret = open + tag,
                    attrs = node.attributes;
                if (attrs) {
                  for (i = 0, len = attrs.length; i < len; i++) {
                    val = attrs[i].nodeValue;
                    if (val && val !== "inherit") {
                      ret += " " + attrs[i].nodeName + "=" + dump.parse(val, "attribute");
                    }
                  }
                }
                ret += close;
                if (node.nodeType === 3 || node.nodeType === 4) {
                  ret += node.nodeValue;
                }
                return ret + open + "/" + tag + close;
              },
              functionArgs: function(fn) {
                var args,
                    l = fn.length;
                if (!l) {
                  return "";
                }
                args = new Array(l);
                while (l--) {
                  args[l] = String.fromCharCode(97 + l);
                }
                return " " + args.join(", ") + " ";
              },
              key: quote,
              functionCode: "[code]",
              attribute: quote,
              string: quote,
              date: quote,
              regexp: literal,
              number: literal,
              "boolean": literal
            },
            HTML: false,
            indentChar: "  ",
            multiline: true
          };
      return dump;
    }());
    QUnit.jsDump = QUnit.dump;
    if (typeof window !== "undefined") {
      (function() {
        var i,
            assertions = Assert.prototype;
        function applyCurrent(current) {
          return function() {
            var assert = new Assert(QUnit.config.current);
            current.apply(assert, arguments);
          };
        }
        for (i in assertions) {
          QUnit[i] = applyCurrent(assertions[i]);
        }
      })();
      (function() {
        var i,
            l,
            keys = ["test", "module", "expect", "asyncTest", "start", "stop", "ok", "equal", "notEqual", "propEqual", "notPropEqual", "deepEqual", "notDeepEqual", "strictEqual", "notStrictEqual", "throws"];
        for (i = 0, l = keys.length; i < l; i++) {
          window[keys[i]] = QUnit[keys[i]];
        }
      })();
      window.QUnit = QUnit;
    }
    if (typeof module !== "undefined" && module.exports) {
      module.exports = QUnit;
    }
  }((function() {
    return this;
  })()));
  QUnit.diff = (function() {
    var hasOwn = Object.prototype.hasOwnProperty;
    function diff(o, n) {
      var i,
          ns = {},
          os = {};
      for (i = 0; i < n.length; i++) {
        if (!hasOwn.call(ns, n[i])) {
          ns[n[i]] = {
            rows: [],
            o: null
          };
        }
        ns[n[i]].rows.push(i);
      }
      for (i = 0; i < o.length; i++) {
        if (!hasOwn.call(os, o[i])) {
          os[o[i]] = {
            rows: [],
            n: null
          };
        }
        os[o[i]].rows.push(i);
      }
      for (i in ns) {
        if (hasOwn.call(ns, i)) {
          if (ns[i].rows.length === 1 && hasOwn.call(os, i) && os[i].rows.length === 1) {
            n[ns[i].rows[0]] = {
              text: n[ns[i].rows[0]],
              row: os[i].rows[0]
            };
            o[os[i].rows[0]] = {
              text: o[os[i].rows[0]],
              row: ns[i].rows[0]
            };
          }
        }
      }
      for (i = 0; i < n.length - 1; i++) {
        if (n[i].text != null && n[i + 1].text == null && n[i].row + 1 < o.length && o[n[i].row + 1].text == null && n[i + 1] == o[n[i].row + 1]) {
          n[i + 1] = {
            text: n[i + 1],
            row: n[i].row + 1
          };
          o[n[i].row + 1] = {
            text: o[n[i].row + 1],
            row: i + 1
          };
        }
      }
      for (i = n.length - 1; i > 0; i--) {
        if (n[i].text != null && n[i - 1].text == null && n[i].row > 0 && o[n[i].row - 1].text == null && n[i - 1] == o[n[i].row - 1]) {
          n[i - 1] = {
            text: n[i - 1],
            row: n[i].row - 1
          };
          o[n[i].row - 1] = {
            text: o[n[i].row - 1],
            row: i - 1
          };
        }
      }
      return {
        o: o,
        n: n
      };
    }
    return function(o, n) {
      o = o.replace(/\s+$/, "");
      n = n.replace(/\s+$/, "");
      var i,
          pre,
          str = "",
          out = diff(o === "" ? [] : o.split(/\s+/), n === "" ? [] : n.split(/\s+/)),
          oSpace = o.match(/\s+/g),
          nSpace = n.match(/\s+/g);
      if (oSpace == null) {
        oSpace = [" "];
      } else {
        oSpace.push(" ");
      }
      if (nSpace == null) {
        nSpace = [" "];
      } else {
        nSpace.push(" ");
      }
      if (out.n.length === 0) {
        for (i = 0; i < out.o.length; i++) {
          str += "<del>" + out.o[i] + oSpace[i] + "</del>";
        }
      } else {
        if (out.n[0].text == null) {
          for (n = 0; n < out.o.length && out.o[n].text == null; n++) {
            str += "<del>" + out.o[n] + oSpace[n] + "</del>";
          }
        }
        for (i = 0; i < out.n.length; i++) {
          if (out.n[i].text == null) {
            str += "<ins>" + out.n[i] + nSpace[i] + "</ins>";
          } else {
            pre = "";
            for (n = out.n[i].row + 1; n < out.o.length && out.o[n].text == null; n++) {
              pre += "<del>" + out.o[n] + oSpace[n] + "</del>";
            }
            str += " " + out.n[i].text + nSpace[i] + pre;
          }
        }
      }
      return str;
    };
  }());
  (function() {
    QUnit.init = function() {
      var tests,
          banner,
          result,
          qunit,
          config = QUnit.config;
      config.stats = {
        all: 0,
        bad: 0
      };
      config.moduleStats = {
        all: 0,
        bad: 0
      };
      config.started = 0;
      config.updateRate = 1000;
      config.blocking = false;
      config.autostart = true;
      config.autorun = false;
      config.filter = "";
      config.queue = [];
      config.semaphore = 1;
      if (typeof window === "undefined") {
        return ;
      }
      qunit = id("qunit");
      if (qunit) {
        qunit.innerHTML = "<h1 id='qunit-header'>" + escapeText(document.title) + "</h1>" + "<h2 id='qunit-banner'></h2>" + "<div id='qunit-testrunner-toolbar'></div>" + "<h2 id='qunit-userAgent'></h2>" + "<ol id='qunit-tests'></ol>";
      }
      tests = id("qunit-tests");
      banner = id("qunit-banner");
      result = id("qunit-testresult");
      if (tests) {
        tests.innerHTML = "";
      }
      if (banner) {
        banner.className = "";
      }
      if (result) {
        result.parentNode.removeChild(result);
      }
      if (tests) {
        result = document.createElement("p");
        result.id = "qunit-testresult";
        result.className = "result";
        tests.parentNode.insertBefore(result, tests);
        result.innerHTML = "Running...<br/>&nbsp;";
      }
    };
    QUnit.reset = function() {
      if (typeof window === "undefined") {
        return ;
      }
      var fixture = id("qunit-fixture");
      if (fixture) {
        fixture.innerHTML = config.fixture;
      }
    };
    if (typeof window === "undefined") {
      return ;
    }
    var config = QUnit.config,
        hasOwn = Object.prototype.hasOwnProperty,
        defined = {
          document: typeof window.document !== "undefined",
          sessionStorage: (function() {
            var x = "qunit-test-string";
            try {
              sessionStorage.setItem(x, x);
              sessionStorage.removeItem(x);
              return true;
            } catch (e) {
              return false;
            }
          }())
        };
    function escapeText(s) {
      if (!s) {
        return "";
      }
      s = s + "";
      return s.replace(/['"<>&]/g, function(s) {
        switch (s) {
          case "'":
            return "&#039;";
          case "\"":
            return "&quot;";
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case "&":
            return "&amp;";
        }
      });
    }
    function addEvent(elem, type, fn) {
      if (elem.addEventListener) {
        elem.addEventListener(type, fn, false);
      } else if (elem.attachEvent) {
        elem.attachEvent("on" + type, fn);
      }
    }
    function addEvents(elems, type, fn) {
      var i = elems.length;
      while (i--) {
        addEvent(elems[i], type, fn);
      }
    }
    function hasClass(elem, name) {
      return (" " + elem.className + " ").indexOf(" " + name + " ") >= 0;
    }
    function addClass(elem, name) {
      if (!hasClass(elem, name)) {
        elem.className += (elem.className ? " " : "") + name;
      }
    }
    function toggleClass(elem, name) {
      if (hasClass(elem, name)) {
        removeClass(elem, name);
      } else {
        addClass(elem, name);
      }
    }
    function removeClass(elem, name) {
      var set = " " + elem.className + " ";
      while (set.indexOf(" " + name + " ") >= 0) {
        set = set.replace(" " + name + " ", " ");
      }
      elem.className = typeof set.trim === "function" ? set.trim() : set.replace(/^\s+|\s+$/g, "");
    }
    function id(name) {
      return defined.document && document.getElementById && document.getElementById(name);
    }
    function getUrlConfigHtml() {
      var i,
          j,
          val,
          escaped,
          escapedTooltip,
          selection = false,
          len = config.urlConfig.length,
          urlConfigHtml = "";
      for (i = 0; i < len; i++) {
        val = config.urlConfig[i];
        if (typeof val === "string") {
          val = {
            id: val,
            label: val
          };
        }
        escaped = escapeText(val.id);
        escapedTooltip = escapeText(val.tooltip);
        config[val.id] = QUnit.urlParams[val.id];
        if (!val.value || typeof val.value === "string") {
          urlConfigHtml += "<input id='qunit-urlconfig-" + escaped + "' name='" + escaped + "' type='checkbox'" + (val.value ? " value='" + escapeText(val.value) + "'" : "") + (config[val.id] ? " checked='checked'" : "") + " title='" + escapedTooltip + "'><label for='qunit-urlconfig-" + escaped + "' title='" + escapedTooltip + "'>" + val.label + "</label>";
        } else {
          urlConfigHtml += "<label for='qunit-urlconfig-" + escaped + "' title='" + escapedTooltip + "'>" + val.label + ": </label><select id='qunit-urlconfig-" + escaped + "' name='" + escaped + "' title='" + escapedTooltip + "'><option></option>";
          if (QUnit.is("array", val.value)) {
            for (j = 0; j < val.value.length; j++) {
              escaped = escapeText(val.value[j]);
              urlConfigHtml += "<option value='" + escaped + "'" + (config[val.id] === val.value[j] ? (selection = true) && " selected='selected'" : "") + ">" + escaped + "</option>";
            }
          } else {
            for (j in val.value) {
              if (hasOwn.call(val.value, j)) {
                urlConfigHtml += "<option value='" + escapeText(j) + "'" + (config[val.id] === j ? (selection = true) && " selected='selected'" : "") + ">" + escapeText(val.value[j]) + "</option>";
              }
            }
          }
          if (config[val.id] && !selection) {
            escaped = escapeText(config[val.id]);
            urlConfigHtml += "<option value='" + escaped + "' selected='selected' disabled='disabled'>" + escaped + "</option>";
          }
          urlConfigHtml += "</select>";
        }
      }
      return urlConfigHtml;
    }
    function toolbarUrlConfigContainer() {
      var urlConfigContainer = document.createElement("span");
      urlConfigContainer.innerHTML = getUrlConfigHtml();
      addEvents(urlConfigContainer.getElementsByTagName("input"), "click", function(event) {
        var params = {},
            target = event.target || event.srcElement;
        params[target.name] = target.checked ? target.defaultValue || true : undefined;
        window.location = QUnit.url(params);
      });
      addEvents(urlConfigContainer.getElementsByTagName("select"), "change", function(event) {
        var params = {},
            target = event.target || event.srcElement;
        params[target.name] = target.options[target.selectedIndex].value || undefined;
        window.location = QUnit.url(params);
      });
      return urlConfigContainer;
    }
    function getModuleNames() {
      var i,
          moduleNames = [];
      for (i in config.modules) {
        if (config.modules.hasOwnProperty(i)) {
          moduleNames.push(i);
        }
      }
      moduleNames.sort(function(a, b) {
        return a.localeCompare(b);
      });
      return moduleNames;
    }
    function toolbarModuleFilterHtml() {
      var i,
          moduleFilterHtml = "",
          moduleNames = getModuleNames();
      if (moduleNames.length <= 1) {
        return false;
      }
      moduleFilterHtml += "<label for='qunit-modulefilter'>Module: </label>" + "<select id='qunit-modulefilter' name='modulefilter'><option value='' " + (config.module === undefined ? "selected='selected'" : "") + ">< All Modules ></option>";
      for (i = 0; i < moduleNames.length; i++) {
        moduleFilterHtml += "<option value='" + escapeText(encodeURIComponent(moduleNames[i])) + "' " + (config.module === moduleNames[i] ? "selected='selected'" : "") + ">" + escapeText(moduleNames[i]) + "</option>";
      }
      moduleFilterHtml += "</select>";
      return moduleFilterHtml;
    }
    function toolbarModuleFilter() {
      var moduleFilter = document.createElement("span"),
          moduleFilterHtml = toolbarModuleFilterHtml();
      if (!moduleFilterHtml) {
        return false;
      }
      moduleFilter.setAttribute("id", "qunit-modulefilter-container");
      moduleFilter.innerHTML = moduleFilterHtml;
      addEvent(moduleFilter.lastChild, "change", function() {
        var selectBox = moduleFilter.getElementsByTagName("select")[0],
            selectedModule = decodeURIComponent(selectBox.options[selectBox.selectedIndex].value);
        window.location = QUnit.url({
          module: (selectedModule === "") ? undefined : selectedModule,
          filter: undefined,
          testNumber: undefined
        });
      });
      return moduleFilter;
    }
    function toolbarFilter() {
      var testList = id("qunit-tests"),
          filter = document.createElement("input");
      filter.type = "checkbox";
      filter.id = "qunit-filter-pass";
      addEvent(filter, "click", function() {
        if (filter.checked) {
          addClass(testList, "hidepass");
          if (defined.sessionStorage) {
            sessionStorage.setItem("qunit-filter-passed-tests", "true");
          }
        } else {
          removeClass(testList, "hidepass");
          if (defined.sessionStorage) {
            sessionStorage.removeItem("qunit-filter-passed-tests");
          }
        }
      });
      if (config.hidepassed || defined.sessionStorage && sessionStorage.getItem("qunit-filter-passed-tests")) {
        filter.checked = true;
        addClass(testList, "hidepass");
      }
      return filter;
    }
    function toolbarLabel() {
      var label = document.createElement("label");
      label.setAttribute("for", "qunit-filter-pass");
      label.setAttribute("title", "Only show tests and assertions that fail. Stored in sessionStorage.");
      label.innerHTML = "Hide passed tests";
      return label;
    }
    function appendToolbar() {
      var moduleFilter,
          toolbar = id("qunit-testrunner-toolbar");
      if (toolbar) {
        toolbar.appendChild(toolbarFilter());
        toolbar.appendChild(toolbarLabel());
        toolbar.appendChild(toolbarUrlConfigContainer());
        moduleFilter = toolbarModuleFilter();
        if (moduleFilter) {
          toolbar.appendChild(moduleFilter);
        }
      }
    }
    function appendBanner() {
      var banner = id("qunit-banner");
      if (banner) {
        banner.className = "";
        banner.innerHTML = "<a href='" + QUnit.url({
          filter: undefined,
          module: undefined,
          testNumber: undefined
        }) + "'>" + banner.innerHTML + "</a> ";
      }
    }
    function appendTestResults() {
      var tests = id("qunit-tests"),
          result = id("qunit-testresult");
      if (result) {
        result.parentNode.removeChild(result);
      }
      if (tests) {
        tests.innerHTML = "";
        result = document.createElement("p");
        result.id = "qunit-testresult";
        result.className = "result";
        tests.parentNode.insertBefore(result, tests);
        result.innerHTML = "Running...<br>&nbsp;";
      }
    }
    function storeFixture() {
      var fixture = id("qunit-fixture");
      if (fixture) {
        config.fixture = fixture.innerHTML;
      }
    }
    function appendUserAgent() {
      var userAgent = id("qunit-userAgent");
      if (userAgent) {
        userAgent.innerHTML = navigator.userAgent;
      }
    }
    QUnit.begin(function() {
      var qunit = id("qunit");
      if (qunit) {
        qunit.innerHTML = "<h1 id='qunit-header'>" + escapeText(document.title) + "</h1>" + "<h2 id='qunit-banner'></h2>" + "<div id='qunit-testrunner-toolbar'></div>" + "<h2 id='qunit-userAgent'></h2>" + "<ol id='qunit-tests'></ol>";
      }
      appendBanner();
      appendTestResults();
      appendUserAgent();
      appendToolbar();
      storeFixture();
    });
    QUnit.done(function(details) {
      var i,
          key,
          banner = id("qunit-banner"),
          tests = id("qunit-tests"),
          html = ["Tests completed in ", details.runtime, " milliseconds.<br>", "<span class='passed'>", details.passed, "</span> assertions of <span class='total'>", details.total, "</span> passed, <span class='failed'>", details.failed, "</span> failed."].join("");
      if (banner) {
        banner.className = details.failed ? "qunit-fail" : "qunit-pass";
      }
      if (tests) {
        id("qunit-testresult").innerHTML = html;
      }
      if (config.altertitle && defined.document && document.title) {
        document.title = [(details.failed ? "\u2716" : "\u2714"), document.title.replace(/^[\u2714\u2716] /i, "")].join(" ");
      }
      if (config.reorder && defined.sessionStorage && details.failed === 0) {
        for (i = 0; i < sessionStorage.length; i++) {
          key = sessionStorage.key(i++);
          if (key.indexOf("qunit-test-") === 0) {
            sessionStorage.removeItem(key);
          }
        }
      }
      if (config.scrolltop && window.scrollTo) {
        window.scrollTo(0, 0);
      }
    });
    function getNameHtml(name, module) {
      var nameHtml = "";
      if (module) {
        nameHtml = "<span class='module-name'>" + escapeText(module) + "</span>: ";
      }
      nameHtml += "<span class='test-name'>" + escapeText(name) + "</span>";
      return nameHtml;
    }
    QUnit.testStart(function(details) {
      var a,
          b,
          li,
          running,
          assertList,
          name = getNameHtml(details.name, details.module),
          tests = id("qunit-tests");
      if (tests) {
        b = document.createElement("strong");
        b.innerHTML = name;
        a = document.createElement("a");
        a.innerHTML = "Rerun";
        a.href = QUnit.url({testNumber: details.testNumber});
        li = document.createElement("li");
        li.appendChild(b);
        li.appendChild(a);
        li.className = "running";
        li.id = "qunit-test-output" + details.testNumber;
        assertList = document.createElement("ol");
        assertList.className = "qunit-assert-list";
        li.appendChild(assertList);
        tests.appendChild(li);
      }
      running = id("qunit-testresult");
      if (running) {
        running.innerHTML = "Running: <br>" + name;
      }
    });
    QUnit.log(function(details) {
      var assertList,
          assertLi,
          message,
          expected,
          actual,
          testItem = id("qunit-test-output" + details.testNumber);
      if (!testItem) {
        return ;
      }
      message = escapeText(details.message) || (details.result ? "okay" : "failed");
      message = "<span class='test-message'>" + message + "</span>";
      if (!details.result && hasOwn.call(details, "expected")) {
        expected = escapeText(QUnit.dump.parse(details.expected));
        actual = escapeText(QUnit.dump.parse(details.actual));
        message += "<table><tr class='test-expected'><th>Expected: </th><td><pre>" + expected + "</pre></td></tr>";
        if (actual !== expected) {
          message += "<tr class='test-actual'><th>Result: </th><td><pre>" + actual + "</pre></td></tr>" + "<tr class='test-diff'><th>Diff: </th><td><pre>" + QUnit.diff(expected, actual) + "</pre></td></tr>";
        }
        if (details.source) {
          message += "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText(details.source) + "</pre></td></tr>";
        }
        message += "</table>";
      } else if (!details.result && details.source) {
        message += "<table>" + "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText(details.source) + "</pre></td></tr>" + "</table>";
      }
      assertList = testItem.getElementsByTagName("ol")[0];
      assertLi = document.createElement("li");
      assertLi.className = details.result ? "pass" : "fail";
      assertLi.innerHTML = message;
      assertList.appendChild(assertLi);
    });
    QUnit.testDone(function(details) {
      var testTitle,
          time,
          testItem,
          assertList,
          good,
          bad,
          testCounts,
          tests = id("qunit-tests");
      QUnit.reset();
      if (!tests) {
        return ;
      }
      testItem = id("qunit-test-output" + details.testNumber);
      assertList = testItem.getElementsByTagName("ol")[0];
      good = details.passed;
      bad = details.failed;
      if (config.reorder && defined.sessionStorage) {
        if (bad) {
          sessionStorage.setItem("qunit-test-" + details.module + "-" + details.name, bad);
        } else {
          sessionStorage.removeItem("qunit-test-" + details.module + "-" + details.name);
        }
      }
      if (bad === 0) {
        addClass(assertList, "qunit-collapsed");
      }
      testTitle = testItem.firstChild;
      testCounts = bad ? "<b class='failed'>" + bad + "</b>, " + "<b class='passed'>" + good + "</b>, " : "";
      testTitle.innerHTML += " <b class='counts'>(" + testCounts + details.assertions.length + ")</b>";
      addEvent(testTitle, "click", function() {
        toggleClass(assertList, "qunit-collapsed");
      });
      time = document.createElement("span");
      time.className = "runtime";
      time.innerHTML = details.runtime + " ms";
      testItem.className = bad ? "fail" : "pass";
      testItem.insertBefore(time, assertList);
    });
    if (!defined.document || document.readyState === "complete") {
      config.autorun = true;
    }
    if (defined.document) {
      addEvent(window, "load", QUnit.load);
    }
  })();
})(require("process"));
