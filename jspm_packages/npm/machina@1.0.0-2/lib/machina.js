/* */ 
"format cjs";
(function(process) {
  (function(root, factory) {
    if (typeof define === "function" && define.amd) {
      define(["lodash"], function(_) {
        return factory(_, root);
      });
    } else if (typeof module === "object" && module.exports) {
      module.exports = factory(require("lodash"));
    } else {
      root.machina = factory(root._, root);
    }
  }(this, function(_, global, undefined) {
    var slice = [].slice;
    var NEXT_TRANSITION = "transition";
    var HANDLING = "handling";
    var HANDLED = "handled";
    var NO_HANDLER = "nohandler";
    var TRANSITION = "transition";
    var INVALID_STATE = "invalidstate";
    var DEFERRED = "deferred";
    var NEW_FSM = "newfsm";
    function getDefaultBehavioralOptions() {
      return {
        initialState: "uninitialized",
        eventListeners: {"*": []},
        states: {},
        namespace: utils.makeFsmNamespace(),
        useSafeEmit: false,
        hierarchy: {},
        pendingDelegations: {}
      };
    }
    function getDefaultClientMeta() {
      return {
        inputQueue: [],
        targetReplayState: "",
        state: undefined,
        priorState: undefined,
        priorAction: "",
        currentAction: "",
        currentActionArgs: undefined,
        inExitHandler: false
      };
    }
    function getLeaklessArgs(args, startIdx) {
      var result = [];
      for (var i = (startIdx || 0); i < args.length; i++) {
        result[i] = args[i];
      }
      return result;
    }
    function getChildFsmInstance(config) {
      if (!config) {
        return ;
      }
      var childFsmDefinition = {};
      if (typeof config === "object") {
        if (config.factory) {
          childFsmDefinition = config;
        } else {
          childFsmDefinition.factory = function() {
            return config;
          };
        }
      } else if (typeof config === "function") {
        childFsmDefinition.factory = config;
      }
      childFsmDefinition.instance = childFsmDefinition.factory();
      return childFsmDefinition;
    }
    function listenToChild(fsm, child) {
      return child.on("*", function(eventName, data) {
        switch (eventName) {
          case "nohandler":
            if (!data.ticket && !data.delegated && data.namespace !== fsm.namespace) {
              data.args[1].bubbling = true;
            }
            if (data.inputType !== "_reset") {
              fsm.handle.apply(fsm, data.args);
            }
            break;
          case "handling":
            var ticket = data.ticket;
            if (ticket && fsm.pendingDelegations[ticket]) {
              delete fsm.pendingDelegations[ticket];
            }
            fsm.emit(eventName, data);
            break;
          default:
            fsm.emit(eventName, data);
            break;
        }
      });
    }
    var _machKeys = ["states", "initialState"];
    var extend = function(protoProps, staticProps) {
      var parent = this;
      var fsm;
      var machObj = {};
      var ctor = function() {};
      if (protoProps && protoProps.hasOwnProperty('constructor')) {
        fsm = protoProps.constructor;
      } else {
        fsm = function() {
          var args = slice.call(arguments, 0);
          args[0] = args[0] || {};
          var blendedState;
          var instanceStates = args[0].states || {};
          blendedState = _.merge(_.cloneDeep(machObj), {states: instanceStates});
          blendedState.initialState = args[0].initialState || this.initialState;
          _.extend(args[0], blendedState);
          parent.apply(this, args);
        };
      }
      _.merge(fsm, parent);
      ctor.prototype = parent.prototype;
      fsm.prototype = new ctor();
      if (protoProps) {
        _.extend(fsm.prototype, protoProps);
        _.merge(machObj, _.transform(protoProps, function(accum, val, key) {
          if (_machKeys.indexOf(key) !== -1) {
            accum[key] = val;
          }
        }));
      }
      if (staticProps) {
        _.merge(fsm, staticProps);
      }
      fsm.prototype.constructor = fsm;
      fsm.__super__ = parent.prototype;
      return fsm;
    };
    function createUUID() {
      var s = [];
      var hexDigits = "0123456789abcdef";
      for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
      }
      s[14] = "4";
      s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
      s[8] = s[13] = s[18] = s[23] = "-";
      return s.join("");
    }
    var utils = {
      makeFsmNamespace: (function() {
        var machinaCount = 0;
        return function() {
          return "fsm." + machinaCount++;
        };
      })(),
      listenToChild: listenToChild,
      getLeaklessArgs: getLeaklessArgs,
      getDefaultOptions: getDefaultBehavioralOptions,
      getDefaultClientMeta: getDefaultClientMeta,
      createUUID: createUUID
    };
    var emitter = {
      emit: function(eventName) {
        var args = getLeaklessArgs(arguments);
        if (this.eventListeners["*"]) {
          _.each(this.eventListeners["*"], function(callback) {
            if (!this.useSafeEmit) {
              callback.apply(this, args);
            } else {
              try {
                callback.apply(this, args);
              } catch (exception) {
                if (console && typeof console.log !== "undefined") {
                  console.log(exception.stack);
                }
              }
            }
          }, this);
        }
        if (this.eventListeners[eventName]) {
          _.each(this.eventListeners[eventName], function(callback) {
            if (!this.useSafeEmit) {
              callback.apply(this, args.slice(1));
            } else {
              try {
                callback.apply(this, args.slice(1));
              } catch (exception) {
                if (console && typeof console.log !== "undefined") {
                  console.log(exception.stack);
                }
              }
            }
          }, this);
        }
      },
      on: function(eventName, callback) {
        var self = this;
        self.eventListeners = self.eventListeners || {"*": []};
        if (!self.eventListeners[eventName]) {
          self.eventListeners[eventName] = [];
        }
        self.eventListeners[eventName].push(callback);
        return {
          eventName: eventName,
          callback: callback,
          off: function() {
            self.off(eventName, callback);
          }
        };
      },
      off: function(eventName, callback) {
        this.eventListeners = this.eventListeners || {"*": []};
        if (!eventName) {
          this.eventListeners = {};
        } else {
          if (callback) {
            this.eventListeners[eventName] = _.without(this.eventListeners[eventName], callback);
          } else {
            this.eventListeners[eventName] = [];
          }
        }
      }
    };
    var MACHINA_PROP = "__machina__";
    function BehavioralFsm(options) {
      _.extend(this, options);
      _.defaults(this, getDefaultBehavioralOptions());
      this.initialize.apply(this, arguments);
      machina.emit(NEW_FSM, this);
    }
    _.extend(BehavioralFsm.prototype, {
      initialize: function() {},
      initClient: function initClient(client) {
        var initialState = this.initialState;
        if (!initialState) {
          throw new Error("You must specify an initial state for this FSM");
        }
        if (!this.states[initialState]) {
          throw new Error("The initial state specified does not exist in the states object.");
        }
        this.transition(client, initialState);
      },
      ensureClientMeta: function ensureClientMeta(client) {
        if (typeof client !== "object") {
          throw new Error("An FSM client must be an object.");
        }
        client[MACHINA_PROP] = client[MACHINA_PROP] || {};
        if (!client[MACHINA_PROP][this.namespace]) {
          client[MACHINA_PROP][this.namespace] = _.cloneDeep(utils.getDefaultClientMeta());
          this.initClient(client);
        }
        return client[MACHINA_PROP][this.namespace];
      },
      buildEventPayload: function(client, data) {
        if (_.isPlainObject(data)) {
          return _.extend(data, {
            client: client,
            namespace: this.namespace
          });
        } else {
          return {
            client: client,
            data: data || null,
            namespace: this.namespace
          };
        }
      },
      getHandlerArgs: function(args, isCatchAll) {
        var _args = args.slice(0);
        var input = _args[1];
        if (typeof input === "object") {
          _args.splice(1, 1, input.inputType);
        }
        return isCatchAll ? _args : [_args[0]].concat(_args.slice(2));
      },
      handle: function(client, input) {
        var inputType;
        var delegated;
        var ticket;
        var inputDef = input;
        if (typeof input === "string") {
          inputDef = {
            inputType: input,
            delegated: false,
            ticket: undefined
          };
        }
        var clientMeta = this.ensureClientMeta(client);
        var args = getLeaklessArgs(arguments);
        if (typeof input !== "object") {
          args.splice(1, 1, inputDef);
        }
        clientMeta.currentActionArgs = args.slice(1);
        var currentState = clientMeta.state;
        var stateObj = this.states[currentState];
        var handlerName;
        var handler;
        var isCatchAll = false;
        var child;
        var result;
        if (!clientMeta.inExitHandler) {
          child = stateObj._child && stateObj._child.instance;
          if (child && !this.pendingDelegations[inputDef.ticket] && !inputDef.bubbling) {
            inputDef.ticket = (inputDef.ticket || utils.createUUID());
            inputDef.delegated = true;
            this.pendingDelegations[inputDef.ticket] = {delegatedTo: child.namespace};
            result = child.handle.apply(child, args);
          } else {
            if (inputDef.ticket && this.pendingDelegations[inputDef.ticket]) {
              delete this.pendingDelegations[inputDef.ticket];
            }
            handlerName = stateObj[inputDef.inputType] ? inputDef.inputType : "*";
            isCatchAll = (handlerName === "*");
            handler = (stateObj[handlerName] || this[handlerName]) || this["*"];
            action = clientMeta.state + "." + handlerName;
            clientMeta.currentAction = action;
            var eventPayload = this.buildEventPayload(client, {
              inputType: inputDef.inputType,
              delegated: inputDef.delegated,
              ticket: inputDef.ticket
            });
            if (!handler) {
              this.emit(NO_HANDLER, _.extend({args: args}, eventPayload));
            } else {
              this.emit(HANDLING, eventPayload);
              if (typeof handler === "function") {
                result = handler.apply(this, this.getHandlerArgs(args, isCatchAll));
              } else {
                result = handler;
                this.transition(client, handler);
              }
              this.emit(HANDLED, eventPayload);
            }
            clientMeta.priorAction = clientMeta.currentAction;
            clientMeta.currentAction = "";
          }
        }
        return result;
      },
      transition: function(client, newState) {
        var clientMeta = this.ensureClientMeta(client);
        var curState = clientMeta.state;
        var curStateObj = this.states[curState];
        var newStateObj = this.states[newState];
        var childDef;
        var child;
        if (!clientMeta.inExitHandler && newState !== curState) {
          if (newStateObj) {
            if (newStateObj._child) {
              newStateObj._child = getChildFsmInstance(newStateObj._child);
              child = newStateObj._child && newStateObj._child.instance;
            }
            if (curStateObj && curStateObj._onExit) {
              clientMeta.inExitHandler = true;
              curStateObj._onExit.call(this, client);
              clientMeta.inExitHandler = false;
            }
            if (curStateObj && curStateObj._child && curStateObj._child.instance && this.hierarchy[curStateObj._child.instance.namespace]) {
              this.hierarchy[curStateObj._child.instance.namespace].off();
            }
            clientMeta.targetReplayState = newState;
            clientMeta.priorState = curState;
            clientMeta.state = newState;
            if (child) {
              this.hierarchy[child.namespace] = utils.listenToChild(this, child);
            }
            var eventPayload = this.buildEventPayload(client, {
              fromState: clientMeta.priorState,
              action: clientMeta.currentAction,
              toState: newState
            });
            this.emit(TRANSITION, eventPayload);
            if (newStateObj._onEnter) {
              newStateObj._onEnter.call(this, client);
            }
            if (child) {
              child.handle(client, "_reset");
            }
            if (clientMeta.targetReplayState === newState) {
              this.processQueue(client, NEXT_TRANSITION);
            }
            return ;
          }
          this.emit(INVALID_STATE, this.buildEventPayload(client, {
            state: clientMeta.state,
            attemptedState: newState
          }));
        }
      },
      deferUntilTransition: function(client, stateName) {
        var clientMeta = this.ensureClientMeta(client);
        if (clientMeta.currentActionArgs) {
          var queued = {
            type: NEXT_TRANSITION,
            untilState: stateName,
            args: clientMeta.currentActionArgs
          };
          clientMeta.inputQueue.push(queued);
          var eventPayload = this.buildEventPayload(client, {
            state: clientMeta.state,
            queuedArgs: queued
          });
          this.emit(DEFERRED, eventPayload);
        }
      },
      deferAndTransition: function(client, stateName) {
        this.deferUntilTransition(client, stateName);
        this.transition(client, stateName);
      },
      processQueue: function(client) {
        var clientMeta = this.ensureClientMeta(client);
        var filterFn = function(item) {
          return ((!item.untilState) || (item.untilState === clientMeta.state));
        };
        var toProcess = _.filter(clientMeta.inputQueue, filterFn);
        clientMeta.inputQueue = _.difference(clientMeta.inputQueue, toProcess);
        _.each(toProcess, function(item) {
          this.handle.apply(this, [client].concat(item.args));
        }, this);
      },
      clearQueue: function(client, name) {
        var clientMeta = this.ensureClientMeta(client);
        if (!name) {
          clientMeta.inputQueue = [];
        } else {
          var filter = function(evnt) {
            return (name ? evnt.untilState !== name : true);
          };
          clientMeta.inputQueue = _.filter(clientMeta.inputQueue, filter);
        }
      }
    }, emitter);
    BehavioralFsm.extend = extend;
    var Fsm = BehavioralFsm.extend({
      constructor: function() {
        BehavioralFsm.apply(this, arguments);
        this.ensureClientMeta();
      },
      initClient: function initClient() {
        var initialState = this.initialState;
        if (!initialState) {
          throw new Error("You must specify an initial state for this FSM");
        }
        if (!this.states[initialState]) {
          throw new Error("The initial state specified does not exist in the states object.");
        }
        this.transition(initialState);
      },
      ensureClientMeta: function ensureClientMeta() {
        if (!this._stamped) {
          this._stamped = true;
          _.defaults(this, _.cloneDeep(getDefaultClientMeta()));
          this.initClient();
        }
        return this;
      },
      ensureClientArg: function(args) {
        var _args = args;
        if (typeof _args[0] === "object" && !("inputType" in _args[0]) && _args[0] !== this) {
          _args.splice(0, 1, this);
        } else if (typeof _args[0] !== "object" || (typeof _args[0] === "object" && ("inputType" in _args[0]))) {
          _args.unshift(this);
        }
        return _args;
      },
      getHandlerArgs: function(args, isCatchAll) {
        var _args = args;
        var input = _args[1];
        if (typeof inputType === "object") {
          _args.splice(1, 1, input.inputType);
        }
        return isCatchAll ? _args.slice(1) : _args.slice(2);
      },
      buildEventPayload: function() {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        var data = args[1];
        if (_.isPlainObject(data)) {
          return _.extend(data, {namespace: this.namespace});
        } else {
          return {
            data: data || null,
            namespace: this.namespace
          };
        }
      },
      handle: function(inputType) {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        return BehavioralFsm.prototype.handle.apply(this, args);
      },
      transition: function(newState) {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        return BehavioralFsm.prototype.transition.apply(this, args);
      },
      deferUntilTransition: function(stateName) {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        return BehavioralFsm.prototype.deferUntilTransition.apply(this, args);
      },
      processQueue: function() {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        return BehavioralFsm.prototype.processQueue.apply(this, args);
      },
      clearQueue: function(stateName) {
        var args = this.ensureClientArg(utils.getLeaklessArgs(arguments));
        return BehavioralFsm.prototype.clearQueue.apply(this, args);
      }
    });
    var machina = _.merge(emitter, {
      Fsm: Fsm,
      BehavioralFsm: BehavioralFsm,
      utils: utils,
      eventListeners: {newFsm: []}
    });
    return machina;
  }));
})(require("process"));
