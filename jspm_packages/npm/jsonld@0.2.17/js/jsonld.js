/* */ 
"format cjs";
(function(process) {
  (function() {
    var _nodejs = (typeof process !== 'undefined' && process.versions && process.versions.node);
    var _browser = !_nodejs && (typeof window !== 'undefined' || typeof self !== 'undefined');
    if (_browser) {
      if (typeof global === 'undefined') {
        if (typeof window !== 'undefined') {
          global = window;
        } else if (typeof self !== 'undefined') {
          global = self;
        } else if (typeof $ !== 'undefined') {
          global = $;
        }
      }
    }
    var wrapper = function(jsonld) {
      jsonld.compact = function(input, ctx, options, callback) {
        if (arguments.length < 2) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not compact, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (ctx === null) {
          return jsonld.nextTick(function() {
            callback(new JsonLdError('The compaction context must not be null.', 'jsonld.CompactError', {code: 'invalid local context'}));
          });
        }
        if (input === null) {
          return jsonld.nextTick(function() {
            callback(null, null);
          });
        }
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('compactArrays' in options)) {
          options.compactArrays = true;
        }
        if (!('graph' in options)) {
          options.graph = false;
        }
        if (!('skipExpansion' in options)) {
          options.skipExpansion = false;
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        var expand = function(input, options, callback) {
          jsonld.nextTick(function() {
            if (options.skipExpansion) {
              return callback(null, input);
            }
            jsonld.expand(input, options, callback);
          });
        };
        expand(input, options, function(err, expanded) {
          if (err) {
            return callback(new JsonLdError('Could not expand input before compaction.', 'jsonld.CompactError', {cause: err}));
          }
          var activeCtx = _getInitialContext(options);
          jsonld.processContext(activeCtx, ctx, options, function(err, activeCtx) {
            if (err) {
              return callback(new JsonLdError('Could not process context before compaction.', 'jsonld.CompactError', {cause: err}));
            }
            var compacted;
            try {
              compacted = new Processor().compact(activeCtx, null, expanded, options);
            } catch (ex) {
              return callback(ex);
            }
            cleanup(null, compacted, activeCtx, options);
          });
        });
        function cleanup(err, compacted, activeCtx, options) {
          if (err) {
            return callback(err);
          }
          if (options.compactArrays && !options.graph && _isArray(compacted)) {
            if (compacted.length === 1) {
              compacted = compacted[0];
            } else if (compacted.length === 0) {
              compacted = {};
            }
          } else if (options.graph && _isObject(compacted)) {
            compacted = [compacted];
          }
          if (_isObject(ctx) && '@context' in ctx) {
            ctx = ctx['@context'];
          }
          ctx = _clone(ctx);
          if (!_isArray(ctx)) {
            ctx = [ctx];
          }
          var tmp = ctx;
          ctx = [];
          for (var i = 0; i < tmp.length; ++i) {
            if (!_isObject(tmp[i]) || Object.keys(tmp[i]).length > 0) {
              ctx.push(tmp[i]);
            }
          }
          var hasContext = (ctx.length > 0);
          if (ctx.length === 1) {
            ctx = ctx[0];
          }
          if (_isArray(compacted)) {
            var kwgraph = _compactIri(activeCtx, '@graph');
            var graph = compacted;
            compacted = {};
            if (hasContext) {
              compacted['@context'] = ctx;
            }
            compacted[kwgraph] = graph;
          } else if (_isObject(compacted) && hasContext) {
            var graph = compacted;
            compacted = {'@context': ctx};
            for (var key in graph) {
              compacted[key] = graph[key];
            }
          }
          callback(null, compacted, activeCtx);
        }
      };
      jsonld.expand = function(input, options, callback) {
        if (arguments.length < 1) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not expand, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        if (!('keepFreeFloatingNodes' in options)) {
          options.keepFreeFloatingNodes = false;
        }
        jsonld.nextTick(function() {
          if (typeof input === 'string') {
            var done = function(err, remoteDoc) {
              if (err) {
                return callback(err);
              }
              try {
                if (!remoteDoc.document) {
                  throw new JsonLdError('No remote document found at the given URL.', 'jsonld.NullRemoteDocument');
                }
                if (typeof remoteDoc.document === 'string') {
                  remoteDoc.document = JSON.parse(remoteDoc.document);
                }
              } catch (ex) {
                return callback(new JsonLdError('Could not retrieve a JSON-LD document from the URL. URL ' + 'dereferencing not implemented.', 'jsonld.LoadDocumentError', {
                  code: 'loading document failed',
                  cause: ex,
                  remoteDoc: remoteDoc
                }));
              }
              expand(remoteDoc);
            };
            var promise = options.documentLoader(input, done);
            if (promise && 'then' in promise) {
              promise.then(done.bind(null, null), done);
            }
            return ;
          }
          expand({
            contextUrl: null,
            documentUrl: null,
            document: input
          });
        });
        function expand(remoteDoc) {
          if (!('base' in options)) {
            options.base = remoteDoc.documentUrl || '';
          }
          var input = {
            document: _clone(remoteDoc.document),
            remoteContext: {'@context': remoteDoc.contextUrl}
          };
          if ('expandContext' in options) {
            var expandContext = _clone(options.expandContext);
            if (typeof expandContext === 'object' && '@context' in expandContext) {
              input.expandContext = expandContext;
            } else {
              input.expandContext = {'@context': expandContext};
            }
          }
          _retrieveContextUrls(input, options, function(err, input) {
            if (err) {
              return callback(err);
            }
            var expanded;
            try {
              var processor = new Processor();
              var activeCtx = _getInitialContext(options);
              var document = input.document;
              var remoteContext = input.remoteContext['@context'];
              if (input.expandContext) {
                activeCtx = processor.processContext(activeCtx, input.expandContext['@context'], options);
              }
              if (remoteContext) {
                activeCtx = processor.processContext(activeCtx, remoteContext, options);
              }
              expanded = processor.expand(activeCtx, null, document, options, false);
              if (_isObject(expanded) && ('@graph' in expanded) && Object.keys(expanded).length === 1) {
                expanded = expanded['@graph'];
              } else if (expanded === null) {
                expanded = [];
              }
              if (!_isArray(expanded)) {
                expanded = [expanded];
              }
            } catch (ex) {
              return callback(ex);
            }
            callback(null, expanded);
          });
        }
      };
      jsonld.flatten = function(input, ctx, options, callback) {
        if (arguments.length < 1) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not flatten, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        } else if (typeof ctx === 'function') {
          callback = ctx;
          ctx = null;
          options = {};
        }
        options = options || {};
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        jsonld.expand(input, options, function(err, _input) {
          if (err) {
            return callback(new JsonLdError('Could not expand input before flattening.', 'jsonld.FlattenError', {cause: err}));
          }
          var flattened;
          try {
            flattened = new Processor().flatten(_input);
          } catch (ex) {
            return callback(ex);
          }
          if (ctx === null) {
            return callback(null, flattened);
          }
          options.graph = true;
          options.skipExpansion = true;
          jsonld.compact(flattened, ctx, options, function(err, compacted) {
            if (err) {
              return callback(new JsonLdError('Could not compact flattened output.', 'jsonld.FlattenError', {cause: err}));
            }
            callback(null, compacted);
          });
        });
      };
      jsonld.frame = function(input, frame, options, callback) {
        if (arguments.length < 2) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not frame, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        if (!('embed' in options)) {
          options.embed = true;
        }
        options.explicit = options.explicit || false;
        options.omitDefault = options.omitDefault || false;
        jsonld.nextTick(function() {
          if (typeof frame === 'string') {
            var done = function(err, remoteDoc) {
              if (err) {
                return callback(err);
              }
              try {
                if (!remoteDoc.document) {
                  throw new JsonLdError('No remote document found at the given URL.', 'jsonld.NullRemoteDocument');
                }
                if (typeof remoteDoc.document === 'string') {
                  remoteDoc.document = JSON.parse(remoteDoc.document);
                }
              } catch (ex) {
                return callback(new JsonLdError('Could not retrieve a JSON-LD document from the URL. URL ' + 'dereferencing not implemented.', 'jsonld.LoadDocumentError', {
                  code: 'loading document failed',
                  cause: ex,
                  remoteDoc: remoteDoc
                }));
              }
              doFrame(remoteDoc);
            };
            var promise = options.documentLoader(frame, done);
            if (promise && 'then' in promise) {
              promise.then(done.bind(null, null), done);
            }
            return ;
          }
          doFrame({
            contextUrl: null,
            documentUrl: null,
            document: frame
          });
        });
        function doFrame(remoteFrame) {
          var frame = remoteFrame.document;
          var ctx;
          if (frame) {
            ctx = frame['@context'];
            if (remoteFrame.contextUrl) {
              if (!ctx) {
                ctx = remoteFrame.contextUrl;
              } else if (_isArray(ctx)) {
                ctx.push(remoteFrame.contextUrl);
              } else {
                ctx = [ctx, remoteFrame.contextUrl];
              }
              frame['@context'] = ctx;
            } else {
              ctx = ctx || {};
            }
          } else {
            ctx = {};
          }
          jsonld.expand(input, options, function(err, expanded) {
            if (err) {
              return callback(new JsonLdError('Could not expand input before framing.', 'jsonld.FrameError', {cause: err}));
            }
            var opts = _clone(options);
            opts.isFrame = true;
            opts.keepFreeFloatingNodes = true;
            jsonld.expand(frame, opts, function(err, expandedFrame) {
              if (err) {
                return callback(new JsonLdError('Could not expand frame before framing.', 'jsonld.FrameError', {cause: err}));
              }
              var framed;
              try {
                framed = new Processor().frame(expanded, expandedFrame, opts);
              } catch (ex) {
                return callback(ex);
              }
              opts.graph = true;
              opts.skipExpansion = true;
              jsonld.compact(framed, ctx, opts, function(err, compacted, ctx) {
                if (err) {
                  return callback(new JsonLdError('Could not compact framed output.', 'jsonld.FrameError', {cause: err}));
                }
                var graph = _compactIri(ctx, '@graph');
                compacted[graph] = _removePreserve(ctx, compacted[graph], opts);
                callback(null, compacted);
              });
            });
          });
        }
      };
      jsonld.objectify = function(input, ctx, options, callback) {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        jsonld.expand(input, options, function(err, _input) {
          if (err) {
            return callback(new JsonLdError('Could not expand input before framing.', 'jsonld.FrameError', {cause: err}));
          }
          var flattened;
          try {
            flattened = new Processor().flatten(_input);
          } catch (ex) {
            return callback(ex);
          }
          options.graph = true;
          options.skipExpansion = true;
          jsonld.compact(flattened, ctx, options, function(err, compacted, ctx) {
            if (err) {
              return callback(new JsonLdError('Could not compact flattened output.', 'jsonld.FrameError', {cause: err}));
            }
            var graph = _compactIri(ctx, '@graph');
            compacted[graph] = _removePreserve(ctx, compacted[graph], options);
            var top = compacted[graph][0];
            var recurse = function(subject) {
              if (!_isObject(subject) && !_isArray(subject)) {
                return ;
              }
              if (_isObject(subject)) {
                if (recurse.visited[subject['@id']]) {
                  return ;
                }
                recurse.visited[subject['@id']] = true;
              }
              for (var k in subject) {
                var obj = subject[k];
                var isid = (jsonld.getContextValue(ctx, k, '@type') === '@id');
                if (!_isArray(obj) && !_isObject(obj) && !isid) {
                  continue;
                }
                if (_isString(obj) && isid) {
                  subject[k] = obj = top[obj];
                  recurse(obj);
                } else if (_isArray(obj)) {
                  for (var i = 0; i < obj.length; ++i) {
                    if (_isString(obj[i]) && isid) {
                      obj[i] = top[obj[i]];
                    } else if (_isObject(obj[i]) && '@id' in obj[i]) {
                      obj[i] = top[obj[i]['@id']];
                    }
                    recurse(obj[i]);
                  }
                } else if (_isObject(obj)) {
                  var sid = obj['@id'];
                  subject[k] = obj = top[sid];
                  recurse(obj);
                }
              }
            };
            recurse.visited = {};
            recurse(top);
            compacted.of_type = {};
            for (var s in top) {
              if (!('@type' in top[s])) {
                continue;
              }
              var types = top[s]['@type'];
              if (!_isArray(types)) {
                types = [types];
              }
              for (var t in types) {
                if (!(types[t] in compacted.of_type)) {
                  compacted.of_type[types[t]] = [];
                }
                compacted.of_type[types[t]].push(top[s]);
              }
            }
            callback(null, compacted);
          });
        });
      };
      jsonld.normalize = function(input, options, callback) {
        if (arguments.length < 1) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not normalize, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        var opts = _clone(options);
        delete opts.format;
        opts.produceGeneralizedRdf = false;
        jsonld.toRDF(input, opts, function(err, dataset) {
          if (err) {
            return callback(new JsonLdError('Could not convert input to RDF dataset before normalization.', 'jsonld.NormalizeError', {cause: err}));
          }
          new Processor().normalize(dataset, options, callback);
        });
      };
      jsonld.fromRDF = function(dataset, options, callback) {
        if (arguments.length < 1) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not convert from RDF, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('useRdfType' in options)) {
          options.useRdfType = false;
        }
        if (!('useNativeTypes' in options)) {
          options.useNativeTypes = false;
        }
        if (!('format' in options) && _isString(dataset)) {
          if (!('format' in options)) {
            options.format = 'application/nquads';
          }
        }
        jsonld.nextTick(function() {
          var rdfParser;
          if (options.format) {
            rdfParser = options.rdfParser || _rdfParsers[options.format];
            if (!rdfParser) {
              return callback(new JsonLdError('Unknown input format.', 'jsonld.UnknownFormat', {format: options.format}));
            }
          } else {
            rdfParser = function() {
              return dataset;
            };
          }
          dataset = rdfParser(dataset, function(err, dataset) {
            if (err) {
              return callback(err);
            }
            fromRDF(dataset, options, callback);
          });
          if (dataset) {
            if ('then' in dataset) {
              return dataset.then(function(dataset) {
                fromRDF(dataset, options, callback);
              }, callback);
            }
            fromRDF(dataset, options, callback);
          }
          function fromRDF(dataset, options, callback) {
            new Processor().fromRDF(dataset, options, callback);
          }
        });
      };
      jsonld.toRDF = function(input, options, callback) {
        if (arguments.length < 1) {
          return jsonld.nextTick(function() {
            callback(new TypeError('Could not convert to RDF, too few arguments.'));
          });
        }
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        options = options || {};
        if (!('base' in options)) {
          options.base = (typeof input === 'string') ? input : '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        jsonld.expand(input, options, function(err, expanded) {
          if (err) {
            return callback(new JsonLdError('Could not expand input before serialization to RDF.', 'jsonld.RdfError', {cause: err}));
          }
          var dataset;
          try {
            dataset = Processor.prototype.toRDF(expanded, options);
            if (options.format) {
              if (options.format === 'application/nquads') {
                return callback(null, _toNQuads(dataset));
              }
              throw new JsonLdError('Unknown output format.', 'jsonld.UnknownFormat', {format: options.format});
            }
          } catch (ex) {
            return callback(ex);
          }
          callback(null, dataset);
        });
      };
      jsonld.relabelBlankNodes = function(input) {
        _labelBlankNodes(new UniqueNamer('_:b', input));
      };
      jsonld.documentLoader = function(url, callback) {
        var err = new JsonLdError('Could not retrieve a JSON-LD document from the URL. URL ' + 'dereferencing not implemented.', 'jsonld.LoadDocumentError', {code: 'loading document failed'});
        if (_nodejs) {
          return callback(err, {
            contextUrl: null,
            documentUrl: url,
            document: null
          });
        }
        return jsonld.promisify(function(callback) {
          callback(err);
        });
      };
      jsonld.loadDocument = function(url, callback) {
        var promise = jsonld.documentLoader(url, callback);
        if (promise && 'then' in promise) {
          promise.then(callback.bind(null, null), callback);
        }
      };
      jsonld.promises = function() {
        try {
          jsonld.Promise = global.Promise || require("es6-promise").Promise;
        } catch (e) {
          throw new Error('Unable to find a Promise implementation.');
        }
        var slice = Array.prototype.slice;
        var promisify = jsonld.promisify;
        var api = {};
        api.expand = function(input) {
          if (arguments.length < 1) {
            throw new TypeError('Could not expand, too few arguments.');
          }
          return promisify.apply(null, [jsonld.expand].concat(slice.call(arguments)));
        };
        api.compact = function(input, ctx) {
          if (arguments.length < 2) {
            throw new TypeError('Could not compact, too few arguments.');
          }
          var compact = function(input, ctx, options, callback) {
            jsonld.compact(input, ctx, options, function(err, compacted) {
              callback(err, compacted);
            });
          };
          return promisify.apply(null, [compact].concat(slice.call(arguments)));
        };
        api.flatten = function(input) {
          if (arguments.length < 1) {
            throw new TypeError('Could not flatten, too few arguments.');
          }
          return promisify.apply(null, [jsonld.flatten].concat(slice.call(arguments)));
        };
        api.frame = function(input, frame) {
          if (arguments.length < 2) {
            throw new TypeError('Could not frame, too few arguments.');
          }
          return promisify.apply(null, [jsonld.frame].concat(slice.call(arguments)));
        };
        api.fromRDF = function(dataset) {
          if (arguments.length < 1) {
            throw new TypeError('Could not convert from RDF, too few arguments.');
          }
          return promisify.apply(null, [jsonld.fromRDF].concat(slice.call(arguments)));
        };
        api.toRDF = function(input) {
          if (arguments.length < 1) {
            throw new TypeError('Could not convert to RDF, too few arguments.');
          }
          return promisify.apply(null, [jsonld.toRDF].concat(slice.call(arguments)));
        };
        api.normalize = function(input) {
          if (arguments.length < 1) {
            throw new TypeError('Could not normalize, too few arguments.');
          }
          return promisify.apply(null, [jsonld.normalize].concat(slice.call(arguments)));
        };
        return api;
      };
      jsonld.promisify = function(op) {
        if (!jsonld.Promise) {
          try {
            jsonld.Promise = global.Promise || require("es6-promise").Promise;
          } catch (e) {
            throw new Error('Unable to find a Promise implementation.');
          }
        }
        var args = Array.prototype.slice.call(arguments, 1);
        return new jsonld.Promise(function(resolve, reject) {
          op.apply(null, args.concat(function(err, value) {
            if (!err) {
              resolve(value);
            } else {
              reject(err);
            }
          }));
        });
      };
      function JsonLdProcessor() {}
      JsonLdProcessor.prototype = jsonld.promises();
      JsonLdProcessor.prototype.toString = function() {
        if (this instanceof JsonLdProcessor) {
          return '[object JsonLdProcessor]';
        }
        return '[object JsonLdProcessorPrototype]';
      };
      jsonld.JsonLdProcessor = JsonLdProcessor;
      var canDefineProperty = !!Object.defineProperty;
      if (canDefineProperty) {
        try {
          Object.defineProperty({}, 'x', {});
        } catch (e) {
          canDefineProperty = false;
        }
      }
      if (canDefineProperty) {
        Object.defineProperty(JsonLdProcessor, 'prototype', {
          writable: false,
          enumerable: false
        });
        Object.defineProperty(JsonLdProcessor.prototype, 'constructor', {
          writable: true,
          enumerable: false,
          configurable: true,
          value: JsonLdProcessor
        });
      }
      if (_browser && typeof global.JsonLdProcessor === 'undefined') {
        if (canDefineProperty) {
          Object.defineProperty(global, 'JsonLdProcessor', {
            writable: true,
            enumerable: false,
            configurable: true,
            value: JsonLdProcessor
          });
        } else {
          global.JsonLdProcessor = JsonLdProcessor;
        }
      }
      if (typeof process === 'undefined' || !process.nextTick) {
        if (typeof setImmediate === 'function') {
          jsonld.setImmediate = jsonld.nextTick = function(callback) {
            return setImmediate(callback);
          };
        } else {
          jsonld.setImmediate = function(callback) {
            setTimeout(callback, 0);
          };
          jsonld.nextTick = jsonld.setImmediate;
        }
      } else {
        jsonld.nextTick = process.nextTick;
        if (typeof setImmediate === 'function') {
          jsonld.setImmediate = setImmediate;
        } else {
          jsonld.setImmediate = jsonld.nextTick;
        }
      }
      jsonld.parseLinkHeader = function(header) {
        var rval = {};
        var entries = header.match(/(?:<[^>]*?>|"[^"]*?"|[^,])+/g);
        var rLinkHeader = /\s*<([^>]*?)>\s*(?:;\s*(.*))?/;
        for (var i = 0; i < entries.length; ++i) {
          var match = entries[i].match(rLinkHeader);
          if (!match) {
            continue;
          }
          var result = {target: match[1]};
          var params = match[2];
          var rParams = /(.*?)=(?:(?:"([^"]*?)")|([^"]*?))\s*(?:(?:;\s*)|$)/g;
          while (match = rParams.exec(params)) {
            result[match[1]] = (match[2] === undefined) ? match[3] : match[2];
          }
          var rel = result['rel'] || '';
          if (_isArray(rval[rel])) {
            rval[rel].push(result);
          } else if (rel in rval) {
            rval[rel] = [rval[rel], result];
          } else {
            rval[rel] = result;
          }
        }
        return rval;
      };
      jsonld.DocumentCache = function(size) {
        this.order = [];
        this.cache = {};
        this.size = size || 50;
        this.expires = 30 * 1000;
      };
      jsonld.DocumentCache.prototype.get = function(url) {
        if (url in this.cache) {
          var entry = this.cache[url];
          if (entry.expires >= +new Date()) {
            return entry.ctx;
          }
          delete this.cache[url];
          this.order.splice(this.order.indexOf(url), 1);
        }
        return null;
      };
      jsonld.DocumentCache.prototype.set = function(url, ctx) {
        if (this.order.length === this.size) {
          delete this.cache[this.order.shift()];
        }
        this.order.push(url);
        this.cache[url] = {
          ctx: ctx,
          expires: (+new Date() + this.expires)
        };
      };
      jsonld.ActiveContextCache = function(size) {
        this.order = [];
        this.cache = {};
        this.size = size || 100;
      };
      jsonld.ActiveContextCache.prototype.get = function(activeCtx, localCtx) {
        var key1 = JSON.stringify(activeCtx);
        var key2 = JSON.stringify(localCtx);
        var level1 = this.cache[key1];
        if (level1 && key2 in level1) {
          return level1[key2];
        }
        return null;
      };
      jsonld.ActiveContextCache.prototype.set = function(activeCtx, localCtx, result) {
        if (this.order.length === this.size) {
          var entry = this.order.shift();
          delete this.cache[entry.activeCtx][entry.localCtx];
        }
        var key1 = JSON.stringify(activeCtx);
        var key2 = JSON.stringify(localCtx);
        this.order.push({
          activeCtx: key1,
          localCtx: key2
        });
        if (!(key1 in this.cache)) {
          this.cache[key1] = {};
        }
        this.cache[key1][key2] = _clone(result);
      };
      jsonld.cache = {activeCtx: new jsonld.ActiveContextCache()};
      jsonld.documentLoaders = {};
      jsonld.documentLoaders.jquery = function($, options) {
        options = options || {};
        var cache = new jsonld.DocumentCache();
        var loader = function(url, callback) {
          if (options.secure && url.indexOf('https') !== 0) {
            return callback(new JsonLdError('URL could not be dereferenced; secure mode is enabled and ' + 'the URL\'s scheme is not "https".', 'jsonld.InvalidUrl', {
              code: 'loading document failed',
              url: url
            }), {
              contextUrl: null,
              documentUrl: url,
              document: null
            });
          }
          var doc = cache.get(url);
          if (doc !== null) {
            return callback(null, doc);
          }
          $.ajax({
            url: url,
            accepts: {json: 'application/ld+json, application/json'},
            headers: {'Accept': 'application/ld+json, application/json'},
            dataType: 'json',
            crossDomain: true,
            success: function(data, textStatus, jqXHR) {
              var doc = {
                contextUrl: null,
                documentUrl: url,
                document: data
              };
              var contentType = jqXHR.getResponseHeader('Content-Type');
              var linkHeader = jqXHR.getResponseHeader('Link');
              if (linkHeader && contentType !== 'application/ld+json') {
                linkHeader = jsonld.parseLinkHeader(linkHeader)[LINK_HEADER_REL];
                if (_isArray(linkHeader)) {
                  return callback(new JsonLdError('URL could not be dereferenced, it has more than one ' + 'associated HTTP Link Header.', 'jsonld.InvalidUrl', {
                    code: 'multiple context link headers',
                    url: url
                  }), doc);
                }
                if (linkHeader) {
                  doc.contextUrl = linkHeader.target;
                }
              }
              cache.set(url, doc);
              callback(null, doc);
            },
            error: function(jqXHR, textStatus, err) {
              callback(new JsonLdError('URL could not be dereferenced, an error occurred.', 'jsonld.LoadDocumentError', {
                code: 'loading document failed',
                url: url,
                cause: err
              }), {
                contextUrl: null,
                documentUrl: url,
                document: null
              });
            }
          });
        };
        var usePromise = (typeof Promise !== 'undefined');
        if ('usePromise' in options) {
          usePromise = options.usePromise;
        }
        if (usePromise) {
          return function(url) {
            return jsonld.promisify(loader, url);
          };
        }
        return loader;
      };
      jsonld.documentLoaders.node = function(options) {
        options = options || {};
        var strictSSL = ('strictSSL' in options) ? options.strictSSL : true;
        var maxRedirects = ('maxRedirects' in options) ? options.maxRedirects : -1;
        var request = require("../browser/ignore");
        var http = require("http");
        var cache = new jsonld.DocumentCache();
        function loadDocument(url, redirects, callback) {
          if (options.secure && url.indexOf('https') !== 0) {
            return callback(new JsonLdError('URL could not be dereferenced; secure mode is enabled and ' + 'the URL\'s scheme is not "https".', 'jsonld.InvalidUrl', {
              code: 'loading document failed',
              url: url
            }), {
              contextUrl: null,
              documentUrl: url,
              document: null
            });
          }
          var doc = cache.get(url);
          if (doc !== null) {
            return callback(null, doc);
          }
          request({
            url: url,
            headers: {'Accept': 'application/ld+json, application/json'},
            strictSSL: strictSSL,
            followRedirect: false
          }, function(err, res, body) {
            doc = {
              contextUrl: null,
              documentUrl: url,
              document: body || null
            };
            if (err) {
              return callback(new JsonLdError('URL could not be dereferenced, an error occurred.', 'jsonld.LoadDocumentError', {
                code: 'loading document failed',
                url: url,
                cause: err
              }), doc);
            }
            var statusText = http.STATUS_CODES[res.statusCode];
            if (res.statusCode >= 400) {
              return callback(new JsonLdError('URL could not be dereferenced: ' + statusText, 'jsonld.InvalidUrl', {
                code: 'loading document failed',
                url: url,
                httpStatusCode: res.statusCode
              }), doc);
            }
            if (res.headers.link && res.headers['content-type'] !== 'application/ld+json') {
              var linkHeader = jsonld.parseLinkHeader(res.headers.link)[LINK_HEADER_REL];
              if (_isArray(linkHeader)) {
                return callback(new JsonLdError('URL could not be dereferenced, it has more than one associated ' + 'HTTP Link Header.', 'jsonld.InvalidUrl', {
                  code: 'multiple context link headers',
                  url: url
                }), doc);
              }
              if (linkHeader) {
                doc.contextUrl = linkHeader.target;
              }
            }
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              if (redirects.length === maxRedirects) {
                return callback(new JsonLdError('URL could not be dereferenced; there were too many redirects.', 'jsonld.TooManyRedirects', {
                  code: 'loading document failed',
                  url: url,
                  httpStatusCode: res.statusCode,
                  redirects: redirects
                }), doc);
              }
              if (redirects.indexOf(url) !== -1) {
                return callback(new JsonLdError('URL could not be dereferenced; infinite redirection was detected.', 'jsonld.InfiniteRedirectDetected', {
                  code: 'recursive context inclusion',
                  url: url,
                  httpStatusCode: res.statusCode,
                  redirects: redirects
                }), doc);
              }
              redirects.push(url);
              return loadDocument(res.headers.location, redirects, callback);
            }
            redirects.push(url);
            for (var i = 0; i < redirects.length; ++i) {
              cache.set(redirects[i], {
                contextUrl: null,
                documentUrl: redirects[i],
                document: body
              });
            }
            callback(err, doc);
          });
        }
        var loader = function(url, callback) {
          loadDocument(url, [], callback);
        };
        if (options.usePromise) {
          return function(url) {
            return jsonld.promisify(loader, url);
          };
        }
        return loader;
      };
      jsonld.documentLoaders.xhr = function(options) {
        var rlink = /(^|(\r\n))link:/i;
        options = options || {};
        var cache = new jsonld.DocumentCache();
        var loader = function(url, callback) {
          if (options.secure && url.indexOf('https') !== 0) {
            return callback(new JsonLdError('URL could not be dereferenced; secure mode is enabled and ' + 'the URL\'s scheme is not "https".', 'jsonld.InvalidUrl', {
              code: 'loading document failed',
              url: url
            }), {
              contextUrl: null,
              documentUrl: url,
              document: null
            });
          }
          var doc = cache.get(url);
          if (doc !== null) {
            return callback(null, doc);
          }
          var xhr = options.xhr || XMLHttpRequest;
          var req = new xhr();
          req.onload = function(e) {
            if (req.status >= 400) {
              return callback(new JsonLdError('URL could not be dereferenced: ' + req.statusText, 'jsonld.LoadDocumentError', {
                code: 'loading document failed',
                url: url,
                httpStatusCode: req.status
              }), {
                contextUrl: null,
                documentUrl: url,
                document: null
              });
            }
            var doc = {
              contextUrl: null,
              documentUrl: url,
              document: req.response
            };
            var contentType = req.getResponseHeader('Content-Type');
            var linkHeader;
            if (rlink.test(req.getAllResponseHeaders())) {
              linkHeader = req.getResponseHeader('Link');
            }
            if (linkHeader && contentType !== 'application/ld+json') {
              linkHeader = jsonld.parseLinkHeader(linkHeader)[LINK_HEADER_REL];
              if (_isArray(linkHeader)) {
                return callback(new JsonLdError('URL could not be dereferenced, it has more than one ' + 'associated HTTP Link Header.', 'jsonld.InvalidUrl', {
                  code: 'multiple context link headers',
                  url: url
                }), doc);
              }
              if (linkHeader) {
                doc.contextUrl = linkHeader.target;
              }
            }
            cache.set(url, doc);
            callback(null, doc);
          };
          req.onerror = function() {
            callback(new JsonLdError('URL could not be dereferenced, an error occurred.', 'jsonld.LoadDocumentError', {
              code: 'loading document failed',
              url: url
            }), {
              contextUrl: null,
              documentUrl: url,
              document: null
            });
          };
          req.open('GET', url, true);
          req.setRequestHeader('Accept', 'application/ld+json, application/json');
          req.send();
        };
        var usePromise = (typeof Promise !== 'undefined');
        if ('usePromise' in options) {
          usePromise = options.usePromise;
        }
        if (usePromise) {
          return function(url) {
            return jsonld.promisify(loader, url);
          };
        }
        return loader;
      };
      jsonld.useDocumentLoader = function(type) {
        if (!(type in jsonld.documentLoaders)) {
          throw new JsonLdError('Unknown document loader type: "' + type + '"', 'jsonld.UnknownDocumentLoader', {type: type});
        }
        jsonld.documentLoader = jsonld.documentLoaders[type].apply(jsonld, Array.prototype.slice.call(arguments, 1));
      };
      jsonld.processContext = function(activeCtx, localCtx) {
        var options = {};
        var callbackArg = 2;
        if (arguments.length > 3) {
          options = arguments[2] || {};
          callbackArg += 1;
        }
        var callback = arguments[callbackArg];
        if (!('base' in options)) {
          options.base = '';
        }
        if (!('documentLoader' in options)) {
          options.documentLoader = jsonld.loadDocument;
        }
        if (localCtx === null) {
          return callback(null, _getInitialContext(options));
        }
        localCtx = _clone(localCtx);
        if (!(_isObject(localCtx) && '@context' in localCtx)) {
          localCtx = {'@context': localCtx};
        }
        _retrieveContextUrls(localCtx, options, function(err, ctx) {
          if (err) {
            return callback(err);
          }
          try {
            ctx = new Processor().processContext(activeCtx, ctx, options);
          } catch (ex) {
            return callback(ex);
          }
          callback(null, ctx);
        });
      };
      jsonld.hasProperty = function(subject, property) {
        var rval = false;
        if (property in subject) {
          var value = subject[property];
          rval = (!_isArray(value) || value.length > 0);
        }
        return rval;
      };
      jsonld.hasValue = function(subject, property, value) {
        var rval = false;
        if (jsonld.hasProperty(subject, property)) {
          var val = subject[property];
          var isList = _isList(val);
          if (_isArray(val) || isList) {
            if (isList) {
              val = val['@list'];
            }
            for (var i = 0; i < val.length; ++i) {
              if (jsonld.compareValues(value, val[i])) {
                rval = true;
                break;
              }
            }
          } else if (!_isArray(value)) {
            rval = jsonld.compareValues(value, val);
          }
        }
        return rval;
      };
      jsonld.addValue = function(subject, property, value, options) {
        options = options || {};
        if (!('propertyIsArray' in options)) {
          options.propertyIsArray = false;
        }
        if (!('allowDuplicate' in options)) {
          options.allowDuplicate = true;
        }
        if (_isArray(value)) {
          if (value.length === 0 && options.propertyIsArray && !(property in subject)) {
            subject[property] = [];
          }
          for (var i = 0; i < value.length; ++i) {
            jsonld.addValue(subject, property, value[i], options);
          }
        } else if (property in subject) {
          var hasValue = (!options.allowDuplicate && jsonld.hasValue(subject, property, value));
          if (!_isArray(subject[property]) && (!hasValue || options.propertyIsArray)) {
            subject[property] = [subject[property]];
          }
          if (!hasValue) {
            subject[property].push(value);
          }
        } else {
          subject[property] = options.propertyIsArray ? [value] : value;
        }
      };
      jsonld.getValues = function(subject, property) {
        var rval = subject[property] || [];
        if (!_isArray(rval)) {
          rval = [rval];
        }
        return rval;
      };
      jsonld.removeProperty = function(subject, property) {
        delete subject[property];
      };
      jsonld.removeValue = function(subject, property, value, options) {
        options = options || {};
        if (!('propertyIsArray' in options)) {
          options.propertyIsArray = false;
        }
        var values = jsonld.getValues(subject, property).filter(function(e) {
          return !jsonld.compareValues(e, value);
        });
        if (values.length === 0) {
          jsonld.removeProperty(subject, property);
        } else if (values.length === 1 && !options.propertyIsArray) {
          subject[property] = values[0];
        } else {
          subject[property] = values;
        }
      };
      jsonld.compareValues = function(v1, v2) {
        if (v1 === v2) {
          return true;
        }
        if (_isValue(v1) && _isValue(v2) && v1['@value'] === v2['@value'] && v1['@type'] === v2['@type'] && v1['@language'] === v2['@language'] && v1['@index'] === v2['@index']) {
          return true;
        }
        if (_isObject(v1) && ('@id' in v1) && _isObject(v2) && ('@id' in v2)) {
          return v1['@id'] === v2['@id'];
        }
        return false;
      };
      jsonld.getContextValue = function(ctx, key, type) {
        var rval = null;
        if (key === null) {
          return rval;
        }
        if (type === '@language' && (type in ctx)) {
          rval = ctx[type];
        }
        if (ctx.mappings[key]) {
          var entry = ctx.mappings[key];
          if (_isUndefined(type)) {
            rval = entry;
          } else if (type in entry) {
            rval = entry[type];
          }
        }
        return rval;
      };
      var _rdfParsers = {};
      jsonld.registerRDFParser = function(contentType, parser) {
        _rdfParsers[contentType] = parser;
      };
      jsonld.unregisterRDFParser = function(contentType) {
        delete _rdfParsers[contentType];
      };
      if (_nodejs) {
        if (typeof XMLSerializer === 'undefined') {
          var XMLSerializer = null;
        }
        if (typeof Node === 'undefined') {
          var Node = {
            ELEMENT_NODE: 1,
            ATTRIBUTE_NODE: 2,
            TEXT_NODE: 3,
            CDATA_SECTION_NODE: 4,
            ENTITY_REFERENCE_NODE: 5,
            ENTITY_NODE: 6,
            PROCESSING_INSTRUCTION_NODE: 7,
            COMMENT_NODE: 8,
            DOCUMENT_NODE: 9,
            DOCUMENT_TYPE_NODE: 10,
            DOCUMENT_FRAGMENT_NODE: 11,
            NOTATION_NODE: 12
          };
        }
      }
      var XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';
      var XSD_DOUBLE = 'http://www.w3.org/2001/XMLSchema#double';
      var XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
      var XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
      var RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
      var RDF_LIST = RDF + 'List';
      var RDF_FIRST = RDF + 'first';
      var RDF_REST = RDF + 'rest';
      var RDF_NIL = RDF + 'nil';
      var RDF_TYPE = RDF + 'type';
      var RDF_PLAIN_LITERAL = RDF + 'PlainLiteral';
      var RDF_XML_LITERAL = RDF + 'XMLLiteral';
      var RDF_OBJECT = RDF + 'object';
      var RDF_LANGSTRING = RDF + 'langString';
      var LINK_HEADER_REL = 'http://www.w3.org/ns/json-ld#context';
      var MAX_CONTEXT_URLS = 10;
      var JsonLdError = function(msg, type, details) {
        if (_nodejs) {
          Error.call(this);
          Error.captureStackTrace(this, this.constructor);
        }
        this.name = type || 'jsonld.Error';
        this.message = msg || 'An unspecified JSON-LD error occurred.';
        this.details = details || {};
      };
      if (_nodejs) {
        require("util").inherits(JsonLdError, Error);
      }
      var Processor = function() {};
      Processor.prototype.compact = function(activeCtx, activeProperty, element, options) {
        if (_isArray(element)) {
          var rval = [];
          for (var i = 0; i < element.length; ++i) {
            var compacted = this.compact(activeCtx, activeProperty, element[i], options);
            if (compacted !== null) {
              rval.push(compacted);
            }
          }
          if (options.compactArrays && rval.length === 1) {
            var container = jsonld.getContextValue(activeCtx, activeProperty, '@container');
            if (container === null) {
              rval = rval[0];
            }
          }
          return rval;
        }
        if (_isObject(element)) {
          if (_isValue(element) || _isSubjectReference(element)) {
            return _compactValue(activeCtx, activeProperty, element);
          }
          var insideReverse = (activeProperty === '@reverse');
          var keys = Object.keys(element).sort();
          var rval = {};
          for (var ki = 0; ki < keys.length; ++ki) {
            var expandedProperty = keys[ki];
            var expandedValue = element[expandedProperty];
            if (expandedProperty === '@id' || expandedProperty === '@type') {
              var compactedValue;
              if (_isString(expandedValue)) {
                compactedValue = _compactIri(activeCtx, expandedValue, null, {vocab: (expandedProperty === '@type')});
              } else {
                compactedValue = [];
                for (var vi = 0; vi < expandedValue.length; ++vi) {
                  compactedValue.push(_compactIri(activeCtx, expandedValue[vi], null, {vocab: true}));
                }
              }
              var alias = _compactIri(activeCtx, expandedProperty);
              var isArray = (_isArray(compactedValue) && expandedValue.length === 0);
              jsonld.addValue(rval, alias, compactedValue, {propertyIsArray: isArray});
              continue;
            }
            if (expandedProperty === '@reverse') {
              var compactedValue = this.compact(activeCtx, '@reverse', expandedValue, options);
              for (var compactedProperty in compactedValue) {
                if (activeCtx.mappings[compactedProperty] && activeCtx.mappings[compactedProperty].reverse) {
                  var value = compactedValue[compactedProperty];
                  var container = jsonld.getContextValue(activeCtx, compactedProperty, '@container');
                  var useArray = (container === '@set' || !options.compactArrays);
                  jsonld.addValue(rval, compactedProperty, value, {propertyIsArray: useArray});
                  delete compactedValue[compactedProperty];
                }
              }
              if (Object.keys(compactedValue).length > 0) {
                var alias = _compactIri(activeCtx, expandedProperty);
                jsonld.addValue(rval, alias, compactedValue);
              }
              continue;
            }
            if (expandedProperty === '@index') {
              var container = jsonld.getContextValue(activeCtx, activeProperty, '@container');
              if (container === '@index') {
                continue;
              }
              var alias = _compactIri(activeCtx, expandedProperty);
              jsonld.addValue(rval, alias, expandedValue);
              continue;
            }
            if (expandedValue.length === 0) {
              var itemActiveProperty = _compactIri(activeCtx, expandedProperty, expandedValue, {vocab: true}, insideReverse);
              jsonld.addValue(rval, itemActiveProperty, expandedValue, {propertyIsArray: true});
            }
            for (var vi = 0; vi < expandedValue.length; ++vi) {
              var expandedItem = expandedValue[vi];
              var itemActiveProperty = _compactIri(activeCtx, expandedProperty, expandedItem, {vocab: true}, insideReverse);
              var container = jsonld.getContextValue(activeCtx, itemActiveProperty, '@container');
              var isList = _isList(expandedItem);
              var list = null;
              if (isList) {
                list = expandedItem['@list'];
              }
              var compactedItem = this.compact(activeCtx, itemActiveProperty, isList ? list : expandedItem, options);
              if (isList) {
                if (!_isArray(compactedItem)) {
                  compactedItem = [compactedItem];
                }
                if (container !== '@list') {
                  var wrapper = {};
                  wrapper[_compactIri(activeCtx, '@list')] = compactedItem;
                  compactedItem = wrapper;
                  if ('@index' in expandedItem) {
                    compactedItem[_compactIri(activeCtx, '@index')] = expandedItem['@index'];
                  }
                } else if (itemActiveProperty in rval) {
                  throw new JsonLdError('JSON-LD compact error; property has a "@list" @container ' + 'rule but there is more than a single @list that matches ' + 'the compacted term in the document. Compaction might mix ' + 'unwanted items into the list.', 'jsonld.SyntaxError', {code: 'compaction to list of lists'});
                }
              }
              if (container === '@language' || container === '@index') {
                var mapObject;
                if (itemActiveProperty in rval) {
                  mapObject = rval[itemActiveProperty];
                } else {
                  rval[itemActiveProperty] = mapObject = {};
                }
                if (container === '@language' && _isValue(compactedItem)) {
                  compactedItem = compactedItem['@value'];
                }
                jsonld.addValue(mapObject, expandedItem[container], compactedItem);
              } else {
                var isArray = (!options.compactArrays || container === '@set' || container === '@list' || (_isArray(compactedItem) && compactedItem.length === 0) || expandedProperty === '@list' || expandedProperty === '@graph');
                jsonld.addValue(rval, itemActiveProperty, compactedItem, {propertyIsArray: isArray});
              }
            }
          }
          return rval;
        }
        return element;
      };
      Processor.prototype.expand = function(activeCtx, activeProperty, element, options, insideList) {
        var self = this;
        if (element === null || element === undefined) {
          return null;
        }
        if (!_isArray(element) && !_isObject(element)) {
          if (!insideList && (activeProperty === null || _expandIri(activeCtx, activeProperty, {vocab: true}) === '@graph')) {
            return null;
          }
          return _expandValue(activeCtx, activeProperty, element);
        }
        if (_isArray(element)) {
          var rval = [];
          var container = jsonld.getContextValue(activeCtx, activeProperty, '@container');
          insideList = insideList || container === '@list';
          for (var i = 0; i < element.length; ++i) {
            var e = self.expand(activeCtx, activeProperty, element[i], options);
            if (insideList && (_isArray(e) || _isList(e))) {
              throw new JsonLdError('Invalid JSON-LD syntax; lists of lists are not permitted.', 'jsonld.SyntaxError', {code: 'list of lists'});
            }
            if (e !== null) {
              if (_isArray(e)) {
                rval = rval.concat(e);
              } else {
                rval.push(e);
              }
            }
          }
          return rval;
        }
        if ('@context' in element) {
          activeCtx = self.processContext(activeCtx, element['@context'], options);
        }
        var expandedActiveProperty = _expandIri(activeCtx, activeProperty, {vocab: true});
        var rval = {};
        var keys = Object.keys(element).sort();
        for (var ki = 0; ki < keys.length; ++ki) {
          var key = keys[ki];
          var value = element[key];
          var expandedValue;
          if (key === '@context') {
            continue;
          }
          var expandedProperty = _expandIri(activeCtx, key, {vocab: true});
          if (expandedProperty === null || !(_isAbsoluteIri(expandedProperty) || _isKeyword(expandedProperty))) {
            continue;
          }
          if (_isKeyword(expandedProperty)) {
            if (expandedActiveProperty === '@reverse') {
              throw new JsonLdError('Invalid JSON-LD syntax; a keyword cannot be used as a @reverse ' + 'property.', 'jsonld.SyntaxError', {
                code: 'invalid reverse property map',
                value: value
              });
            }
            if (expandedProperty in rval) {
              throw new JsonLdError('Invalid JSON-LD syntax; colliding keywords detected.', 'jsonld.SyntaxError', {
                code: 'colliding keywords',
                keyword: expandedProperty
              });
            }
          }
          if (expandedProperty === '@id' && !_isString(value)) {
            if (!options.isFrame) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@id" value must a string.', 'jsonld.SyntaxError', {
                code: 'invalid @id value',
                value: value
              });
            }
            if (!_isObject(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@id" value must be a string or an ' + 'object.', 'jsonld.SyntaxError', {
                code: 'invalid @id value',
                value: value
              });
            }
          }
          if (expandedProperty === '@type') {
            _validateTypeValue(value);
          }
          if (expandedProperty === '@graph' && !(_isObject(value) || _isArray(value))) {
            throw new JsonLdError('Invalid JSON-LD syntax; "@graph" value must not be an ' + 'object or an array.', 'jsonld.SyntaxError', {
              code: 'invalid @graph value',
              value: value
            });
          }
          if (expandedProperty === '@value' && (_isObject(value) || _isArray(value))) {
            throw new JsonLdError('Invalid JSON-LD syntax; "@value" value must not be an ' + 'object or an array.', 'jsonld.SyntaxError', {
              code: 'invalid value object value',
              value: value
            });
          }
          if (expandedProperty === '@language') {
            if (!_isString(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@language" value must be a string.', 'jsonld.SyntaxError', {
                code: 'invalid language-tagged string',
                value: value
              });
            }
            value = value.toLowerCase();
          }
          if (expandedProperty === '@index') {
            if (!_isString(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@index" value must be a string.', 'jsonld.SyntaxError', {
                code: 'invalid @index value',
                value: value
              });
            }
          }
          if (expandedProperty === '@reverse') {
            if (!_isObject(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must be an object.', 'jsonld.SyntaxError', {
                code: 'invalid @reverse value',
                value: value
              });
            }
            expandedValue = self.expand(activeCtx, '@reverse', value, options);
            if ('@reverse' in expandedValue) {
              for (var property in expandedValue['@reverse']) {
                jsonld.addValue(rval, property, expandedValue['@reverse'][property], {propertyIsArray: true});
              }
            }
            var reverseMap = rval['@reverse'] || null;
            for (var property in expandedValue) {
              if (property === '@reverse') {
                continue;
              }
              if (reverseMap === null) {
                reverseMap = rval['@reverse'] = {};
              }
              jsonld.addValue(reverseMap, property, [], {propertyIsArray: true});
              var items = expandedValue[property];
              for (var ii = 0; ii < items.length; ++ii) {
                var item = items[ii];
                if (_isValue(item) || _isList(item)) {
                  throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must not be a ' + '@value or an @list.', 'jsonld.SyntaxError', {
                    code: 'invalid reverse property value',
                    value: expandedValue
                  });
                }
                jsonld.addValue(reverseMap, property, item, {propertyIsArray: true});
              }
            }
            continue;
          }
          var container = jsonld.getContextValue(activeCtx, key, '@container');
          if (container === '@language' && _isObject(value)) {
            expandedValue = _expandLanguageMap(value);
          } else if (container === '@index' && _isObject(value)) {
            expandedValue = (function _expandIndexMap(activeProperty) {
              var rval = [];
              var keys = Object.keys(value).sort();
              for (var ki = 0; ki < keys.length; ++ki) {
                var key = keys[ki];
                var val = value[key];
                if (!_isArray(val)) {
                  val = [val];
                }
                val = self.expand(activeCtx, activeProperty, val, options, false);
                for (var vi = 0; vi < val.length; ++vi) {
                  var item = val[vi];
                  if (!('@index' in item)) {
                    item['@index'] = key;
                  }
                  rval.push(item);
                }
              }
              return rval;
            })(key);
          } else {
            var isList = (expandedProperty === '@list');
            if (isList || expandedProperty === '@set') {
              var nextActiveProperty = activeProperty;
              if (isList && expandedActiveProperty === '@graph') {
                nextActiveProperty = null;
              }
              expandedValue = self.expand(activeCtx, nextActiveProperty, value, options, isList);
              if (isList && _isList(expandedValue)) {
                throw new JsonLdError('Invalid JSON-LD syntax; lists of lists are not permitted.', 'jsonld.SyntaxError', {code: 'list of lists'});
              }
            } else {
              expandedValue = self.expand(activeCtx, key, value, options, false);
            }
          }
          if (expandedValue === null && expandedProperty !== '@value') {
            continue;
          }
          if (expandedProperty !== '@list' && !_isList(expandedValue) && container === '@list') {
            expandedValue = (_isArray(expandedValue) ? expandedValue : [expandedValue]);
            expandedValue = {'@list': expandedValue};
          }
          if (activeCtx.mappings[key] && activeCtx.mappings[key].reverse) {
            var reverseMap = rval['@reverse'] = rval['@reverse'] || {};
            if (!_isArray(expandedValue)) {
              expandedValue = [expandedValue];
            }
            for (var ii = 0; ii < expandedValue.length; ++ii) {
              var item = expandedValue[ii];
              if (_isValue(item) || _isList(item)) {
                throw new JsonLdError('Invalid JSON-LD syntax; "@reverse" value must not be a ' + '@value or an @list.', 'jsonld.SyntaxError', {
                  code: 'invalid reverse property value',
                  value: expandedValue
                });
              }
              jsonld.addValue(reverseMap, expandedProperty, item, {propertyIsArray: true});
            }
            continue;
          }
          var useArray = ['@index', '@id', '@type', '@value', '@language'].indexOf(expandedProperty) === -1;
          jsonld.addValue(rval, expandedProperty, expandedValue, {propertyIsArray: useArray});
        }
        keys = Object.keys(rval);
        var count = keys.length;
        if ('@value' in rval) {
          if ('@type' in rval && '@language' in rval) {
            throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" may not ' + 'contain both "@type" and "@language".', 'jsonld.SyntaxError', {
              code: 'invalid value object',
              element: rval
            });
          }
          var validCount = count - 1;
          if ('@type' in rval) {
            validCount -= 1;
          }
          if ('@index' in rval) {
            validCount -= 1;
          }
          if ('@language' in rval) {
            validCount -= 1;
          }
          if (validCount !== 0) {
            throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" may only ' + 'have an "@index" property and at most one other property ' + 'which can be "@type" or "@language".', 'jsonld.SyntaxError', {
              code: 'invalid value object',
              element: rval
            });
          }
          if (rval['@value'] === null) {
            rval = null;
          } else if ('@language' in rval && !_isString(rval['@value'])) {
            throw new JsonLdError('Invalid JSON-LD syntax; only strings may be language-tagged.', 'jsonld.SyntaxError', {
              code: 'invalid language-tagged value',
              element: rval
            });
          } else if ('@type' in rval && (!_isAbsoluteIri(rval['@type']) || rval['@type'].indexOf('_:') === 0)) {
            throw new JsonLdError('Invalid JSON-LD syntax; an element containing "@value" and "@type" ' + 'must have an absolute IRI for the value of "@type".', 'jsonld.SyntaxError', {
              code: 'invalid typed value',
              element: rval
            });
          }
        } else if ('@type' in rval && !_isArray(rval['@type'])) {
          rval['@type'] = [rval['@type']];
        } else if ('@set' in rval || '@list' in rval) {
          if (count > 1 && !(count === 2 && '@index' in rval)) {
            throw new JsonLdError('Invalid JSON-LD syntax; if an element has the property "@set" ' + 'or "@list", then it can have at most one other property that is ' + '"@index".', 'jsonld.SyntaxError', {
              code: 'invalid set or list object',
              element: rval
            });
          }
          if ('@set' in rval) {
            rval = rval['@set'];
            keys = Object.keys(rval);
            count = keys.length;
          }
        } else if (count === 1 && '@language' in rval) {
          rval = null;
        }
        if (_isObject(rval) && !options.keepFreeFloatingNodes && !insideList && (activeProperty === null || expandedActiveProperty === '@graph')) {
          if (count === 0 || '@value' in rval || '@list' in rval || (count === 1 && '@id' in rval)) {
            rval = null;
          }
        }
        return rval;
      };
      Processor.prototype.flatten = function(input) {
        var namer = new UniqueNamer('_:b');
        var graphs = {'@default': {}};
        _createNodeMap(input, graphs, '@default', namer);
        var defaultGraph = graphs['@default'];
        var graphNames = Object.keys(graphs).sort();
        for (var i = 0; i < graphNames.length; ++i) {
          var graphName = graphNames[i];
          if (graphName === '@default') {
            continue;
          }
          var nodeMap = graphs[graphName];
          var subject = defaultGraph[graphName];
          if (!subject) {
            defaultGraph[graphName] = subject = {
              '@id': graphName,
              '@graph': []
            };
          } else if (!('@graph' in subject)) {
            subject['@graph'] = [];
          }
          var graph = subject['@graph'];
          var ids = Object.keys(nodeMap).sort();
          for (var ii = 0; ii < ids.length; ++ii) {
            var node = nodeMap[ids[ii]];
            if (!_isSubjectReference(node)) {
              graph.push(node);
            }
          }
        }
        var flattened = [];
        var keys = Object.keys(defaultGraph).sort();
        for (var ki = 0; ki < keys.length; ++ki) {
          var node = defaultGraph[keys[ki]];
          if (!_isSubjectReference(node)) {
            flattened.push(node);
          }
        }
        return flattened;
      };
      Processor.prototype.frame = function(input, frame, options) {
        var state = {
          options: options,
          graphs: {
            '@default': {},
            '@merged': {}
          }
        };
        var namer = new UniqueNamer('_:b');
        _createNodeMap(input, state.graphs, '@merged', namer);
        state.subjects = state.graphs['@merged'];
        var framed = [];
        _frame(state, Object.keys(state.subjects).sort(), frame, framed, null);
        return framed;
      };
      Processor.prototype.normalize = function(dataset, options, callback) {
        var quads = [];
        var bnodes = {};
        for (var graphName in dataset) {
          var triples = dataset[graphName];
          if (graphName === '@default') {
            graphName = null;
          }
          for (var ti = 0; ti < triples.length; ++ti) {
            var quad = triples[ti];
            if (graphName !== null) {
              if (graphName.indexOf('_:') === 0) {
                quad.name = {
                  type: 'blank node',
                  value: graphName
                };
              } else {
                quad.name = {
                  type: 'IRI',
                  value: graphName
                };
              }
            }
            quads.push(quad);
            var attrs = ['subject', 'object', 'name'];
            for (var ai = 0; ai < attrs.length; ++ai) {
              var attr = attrs[ai];
              if (quad[attr] && quad[attr].type === 'blank node') {
                var id = quad[attr].value;
                if (id in bnodes) {
                  bnodes[id].quads.push(quad);
                } else {
                  bnodes[id] = {quads: [quad]};
                }
              }
            }
          }
        }
        var namer = new UniqueNamer('_:c14n');
        return hashBlankNodes(Object.keys(bnodes));
        function hashBlankNodes(unnamed) {
          var nextUnnamed = [];
          var duplicates = {};
          var unique = {};
          jsonld.setImmediate(function() {
            hashUnnamed(0);
          });
          function hashUnnamed(i) {
            if (i === unnamed.length) {
              return nameBlankNodes(unique, duplicates, nextUnnamed);
            }
            var bnode = unnamed[i];
            var hash = _hashQuads(bnode, bnodes, namer);
            if (hash in duplicates) {
              duplicates[hash].push(bnode);
              nextUnnamed.push(bnode);
            } else if (hash in unique) {
              duplicates[hash] = [unique[hash], bnode];
              nextUnnamed.push(unique[hash]);
              nextUnnamed.push(bnode);
              delete unique[hash];
            } else {
              unique[hash] = bnode;
            }
            jsonld.setImmediate(function() {
              hashUnnamed(i + 1);
            });
          }
        }
        function nameBlankNodes(unique, duplicates, unnamed) {
          var named = false;
          var hashes = Object.keys(unique).sort();
          for (var i = 0; i < hashes.length; ++i) {
            var bnode = unique[hashes[i]];
            namer.getName(bnode);
            named = true;
          }
          if (named) {
            hashBlankNodes(unnamed);
          } else {
            nameDuplicates(duplicates);
          }
        }
        function nameDuplicates(duplicates) {
          var hashes = Object.keys(duplicates).sort();
          processGroup(0);
          function processGroup(i) {
            if (i === hashes.length) {
              return createArray();
            }
            var group = duplicates[hashes[i]];
            var results = [];
            nameGroupMember(group, 0);
            function nameGroupMember(group, n) {
              if (n === group.length) {
                results.sort(function(a, b) {
                  a = a.hash;
                  b = b.hash;
                  return (a < b) ? -1 : ((a > b) ? 1 : 0);
                });
                for (var r in results) {
                  for (var key in results[r].pathNamer.existing) {
                    namer.getName(key);
                  }
                }
                return processGroup(i + 1);
              }
              var bnode = group[n];
              if (namer.isNamed(bnode)) {
                return nameGroupMember(group, n + 1);
              }
              var pathNamer = new UniqueNamer('_:b');
              pathNamer.getName(bnode);
              _hashPaths(bnode, bnodes, namer, pathNamer, function(err, result) {
                if (err) {
                  return callback(err);
                }
                results.push(result);
                nameGroupMember(group, n + 1);
              });
            }
          }
        }
        function createArray() {
          var normalized = [];
          for (var i = 0; i < quads.length; ++i) {
            var quad = quads[i];
            var attrs = ['subject', 'object', 'name'];
            for (var ai = 0; ai < attrs.length; ++ai) {
              var attr = attrs[ai];
              if (quad[attr] && quad[attr].type === 'blank node' && quad[attr].value.indexOf('_:c14n') !== 0) {
                quad[attr].value = namer.getName(quad[attr].value);
              }
            }
            normalized.push(_toNQuad(quad, quad.name ? quad.name.value : null));
          }
          normalized.sort();
          if (options.format) {
            if (options.format === 'application/nquads') {
              return callback(null, normalized.join(''));
            }
            return callback(new JsonLdError('Unknown output format.', 'jsonld.UnknownFormat', {format: options.format}));
          }
          callback(null, _parseNQuads(normalized.join('')));
        }
      };
      Processor.prototype.fromRDF = function(dataset, options, callback) {
        var defaultGraph = {};
        var graphMap = {'@default': defaultGraph};
        for (var name in dataset) {
          var graph = dataset[name];
          if (!(name in graphMap)) {
            graphMap[name] = {};
          }
          if (name !== '@default' && !(name in defaultGraph)) {
            defaultGraph[name] = {'@id': name};
          }
          var nodeMap = graphMap[name];
          for (var ti = 0; ti < graph.length; ++ti) {
            var triple = graph[ti];
            var s = triple.subject.value;
            var p = triple.predicate.value;
            var o = triple.object;
            if (!(s in nodeMap)) {
              nodeMap[s] = {'@id': s};
            }
            var node = nodeMap[s];
            var objectIsId = (o.type === 'IRI' || o.type === 'blank node');
            if (objectIsId && !(o.value in nodeMap)) {
              nodeMap[o.value] = {'@id': o.value};
            }
            if (p === RDF_TYPE && !options.useRdfType && objectIsId) {
              jsonld.addValue(node, '@type', o.value, {propertyIsArray: true});
              continue;
            }
            var value = _RDFToObject(o, options.useNativeTypes);
            jsonld.addValue(node, p, value, {propertyIsArray: true});
            if (objectIsId) {
              var object = nodeMap[o.value];
              if (!('usages' in object)) {
                object.usages = [];
              }
              object.usages.push({
                node: node,
                property: p,
                value: value
              });
            }
          }
        }
        for (var name in graphMap) {
          var graphObject = graphMap[name];
          if (!(RDF_NIL in graphObject)) {
            continue;
          }
          var nil = graphObject[RDF_NIL];
          for (var i = 0; i < nil.usages.length; ++i) {
            var usage = nil.usages[i];
            var node = usage.node;
            var property = usage.property;
            var head = usage.value;
            var list = [];
            var listNodes = [];
            var nodeKeyCount = Object.keys(node).length;
            while (property === RDF_REST && node.usages.length === 1 && _isArray(node[RDF_FIRST]) && node[RDF_FIRST].length === 1 && _isArray(node[RDF_REST]) && node[RDF_REST].length === 1 && (nodeKeyCount === 4 || (nodeKeyCount === 5 && _isArray(node['@type']) && node['@type'].length === 1 && node['@type'][0] === RDF_LIST))) {
              list.push(node[RDF_FIRST][0]);
              listNodes.push(node['@id']);
              usage = node.usages[0];
              node = usage.node;
              property = usage.property;
              head = usage.value;
              nodeKeyCount = Object.keys(node).length;
              if (node['@id'].indexOf('_:') !== 0) {
                break;
              }
            }
            if (property === RDF_FIRST) {
              if (node['@id'] === RDF_NIL) {
                continue;
              }
              head = graphObject[head['@id']][RDF_REST][0];
              list.pop();
              listNodes.pop();
            }
            delete head['@id'];
            head['@list'] = list.reverse();
            for (var j = 0; j < listNodes.length; ++j) {
              delete graphObject[listNodes[j]];
            }
          }
        }
        var result = [];
        var subjects = Object.keys(defaultGraph).sort();
        for (var i = 0; i < subjects.length; ++i) {
          var subject = subjects[i];
          var node = defaultGraph[subject];
          if (subject in graphMap) {
            var graph = node['@graph'] = [];
            var graphObject = graphMap[subject];
            var subjects_ = Object.keys(graphObject).sort();
            for (var si = 0; si < subjects_.length; ++si) {
              var node_ = graphObject[subjects_[si]];
              delete node_.usages;
              if (!_isSubjectReference(node_)) {
                graph.push(node_);
              }
            }
          }
          delete node.usages;
          if (!_isSubjectReference(node)) {
            result.push(node);
          }
        }
        callback(null, result);
      };
      Processor.prototype.toRDF = function(input, options) {
        var namer = new UniqueNamer('_:b');
        var nodeMap = {'@default': {}};
        _createNodeMap(input, nodeMap, '@default', namer);
        var dataset = {};
        var graphNames = Object.keys(nodeMap).sort();
        for (var i = 0; i < graphNames.length; ++i) {
          var graphName = graphNames[i];
          if (graphName === '@default' || _isAbsoluteIri(graphName)) {
            dataset[graphName] = _graphToRDF(nodeMap[graphName], namer, options);
          }
        }
        return dataset;
      };
      Processor.prototype.processContext = function(activeCtx, localCtx, options) {
        if (_isObject(localCtx) && '@context' in localCtx && _isArray(localCtx['@context'])) {
          localCtx = localCtx['@context'];
        }
        var ctxs = _isArray(localCtx) ? localCtx : [localCtx];
        if (ctxs.length === 0) {
          return activeCtx.clone();
        }
        var rval = activeCtx;
        for (var i = 0; i < ctxs.length; ++i) {
          var ctx = ctxs[i];
          if (ctx === null) {
            rval = activeCtx = _getInitialContext(options);
            continue;
          }
          if (_isObject(ctx) && '@context' in ctx) {
            ctx = ctx['@context'];
          }
          if (!_isObject(ctx)) {
            throw new JsonLdError('Invalid JSON-LD syntax; @context must be an object.', 'jsonld.SyntaxError', {
              code: 'invalid local context',
              context: ctx
            });
          }
          if (jsonld.cache.activeCtx) {
            var cached = jsonld.cache.activeCtx.get(activeCtx, ctx);
            if (cached) {
              rval = activeCtx = cached;
              continue;
            }
          }
          activeCtx = rval;
          rval = rval.clone();
          var defined = {};
          if ('@base' in ctx) {
            var base = ctx['@base'];
            if (base === null) {
              base = null;
            } else if (!_isString(base)) {
              throw new JsonLdError('Invalid JSON-LD syntax; the value of "@base" in a ' + '@context must be a string or null.', 'jsonld.SyntaxError', {
                code: 'invalid base IRI',
                context: ctx
              });
            } else if (base !== '' && !_isAbsoluteIri(base)) {
              throw new JsonLdError('Invalid JSON-LD syntax; the value of "@base" in a ' + '@context must be an absolute IRI or the empty string.', 'jsonld.SyntaxError', {
                code: 'invalid base IRI',
                context: ctx
              });
            }
            if (base !== null) {
              base = jsonld.url.parse(base || '');
            }
            rval['@base'] = base;
            defined['@base'] = true;
          }
          if ('@vocab' in ctx) {
            var value = ctx['@vocab'];
            if (value === null) {
              delete rval['@vocab'];
            } else if (!_isString(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; the value of "@vocab" in a ' + '@context must be a string or null.', 'jsonld.SyntaxError', {
                code: 'invalid vocab mapping',
                context: ctx
              });
            } else if (!_isAbsoluteIri(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; the value of "@vocab" in a ' + '@context must be an absolute IRI.', 'jsonld.SyntaxError', {
                code: 'invalid vocab mapping',
                context: ctx
              });
            } else {
              rval['@vocab'] = value;
            }
            defined['@vocab'] = true;
          }
          if ('@language' in ctx) {
            var value = ctx['@language'];
            if (value === null) {
              delete rval['@language'];
            } else if (!_isString(value)) {
              throw new JsonLdError('Invalid JSON-LD syntax; the value of "@language" in a ' + '@context must be a string or null.', 'jsonld.SyntaxError', {
                code: 'invalid default language',
                context: ctx
              });
            } else {
              rval['@language'] = value.toLowerCase();
            }
            defined['@language'] = true;
          }
          for (var key in ctx) {
            _createTermDefinition(rval, ctx, key, defined);
          }
          if (jsonld.cache.activeCtx) {
            jsonld.cache.activeCtx.set(activeCtx, ctx, rval);
          }
        }
        return rval;
      };
      function _expandLanguageMap(languageMap) {
        var rval = [];
        var keys = Object.keys(languageMap).sort();
        for (var ki = 0; ki < keys.length; ++ki) {
          var key = keys[ki];
          var val = languageMap[key];
          if (!_isArray(val)) {
            val = [val];
          }
          for (var vi = 0; vi < val.length; ++vi) {
            var item = val[vi];
            if (!_isString(item)) {
              throw new JsonLdError('Invalid JSON-LD syntax; language map values must be strings.', 'jsonld.SyntaxError', {
                code: 'invalid language map value',
                languageMap: languageMap
              });
            }
            rval.push({
              '@value': item,
              '@language': key.toLowerCase()
            });
          }
        }
        return rval;
      }
      function _labelBlankNodes(namer, element) {
        if (_isArray(element)) {
          for (var i = 0; i < element.length; ++i) {
            element[i] = _labelBlankNodes(namer, element[i]);
          }
        } else if (_isList(element)) {
          element['@list'] = _labelBlankNodes(namer, element['@list']);
        } else if (_isObject(element)) {
          if (_isBlankNode(element)) {
            element['@id'] = namer.getName(element['@id']);
          }
          var keys = Object.keys(element).sort();
          for (var ki = 0; ki < keys.length; ++ki) {
            var key = keys[ki];
            if (key !== '@id') {
              element[key] = _labelBlankNodes(namer, element[key]);
            }
          }
        }
        return element;
      }
      function _expandValue(activeCtx, activeProperty, value) {
        if (value === null || value === undefined) {
          return null;
        }
        var expandedProperty = _expandIri(activeCtx, activeProperty, {vocab: true});
        if (expandedProperty === '@id') {
          return _expandIri(activeCtx, value, {base: true});
        } else if (expandedProperty === '@type') {
          return _expandIri(activeCtx, value, {
            vocab: true,
            base: true
          });
        }
        var type = jsonld.getContextValue(activeCtx, activeProperty, '@type');
        if (type === '@id' || (expandedProperty === '@graph' && _isString(value))) {
          return {'@id': _expandIri(activeCtx, value, {base: true})};
        }
        if (type === '@vocab') {
          return {'@id': _expandIri(activeCtx, value, {
              vocab: true,
              base: true
            })};
        }
        if (_isKeyword(expandedProperty)) {
          return value;
        }
        var rval = {};
        if (type !== null) {
          rval['@type'] = type;
        } else if (_isString(value)) {
          var language = jsonld.getContextValue(activeCtx, activeProperty, '@language');
          if (language !== null) {
            rval['@language'] = language;
          }
        }
        if (['boolean', 'number', 'string'].indexOf(typeof value) === -1) {
          value = value.toString();
        }
        rval['@value'] = value;
        return rval;
      }
      function _graphToRDF(graph, namer, options) {
        var rval = [];
        var ids = Object.keys(graph).sort();
        for (var i = 0; i < ids.length; ++i) {
          var id = ids[i];
          var node = graph[id];
          var properties = Object.keys(node).sort();
          for (var pi = 0; pi < properties.length; ++pi) {
            var property = properties[pi];
            var items = node[property];
            if (property === '@type') {
              property = RDF_TYPE;
            } else if (_isKeyword(property)) {
              continue;
            }
            for (var ii = 0; ii < items.length; ++ii) {
              var item = items[ii];
              var subject = {};
              subject.type = (id.indexOf('_:') === 0) ? 'blank node' : 'IRI';
              subject.value = id;
              if (!_isAbsoluteIri(id)) {
                continue;
              }
              var predicate = {};
              predicate.type = (property.indexOf('_:') === 0) ? 'blank node' : 'IRI';
              predicate.value = property;
              if (!_isAbsoluteIri(property)) {
                continue;
              }
              if (predicate.type === 'blank node' && !options.produceGeneralizedRdf) {
                continue;
              }
              if (_isList(item)) {
                _listToRDF(item['@list'], namer, subject, predicate, rval);
              } else {
                var object = _objectToRDF(item);
                if (object) {
                  rval.push({
                    subject: subject,
                    predicate: predicate,
                    object: object
                  });
                }
              }
            }
          }
        }
        return rval;
      }
      function _listToRDF(list, namer, subject, predicate, triples) {
        var first = {
          type: 'IRI',
          value: RDF_FIRST
        };
        var rest = {
          type: 'IRI',
          value: RDF_REST
        };
        var nil = {
          type: 'IRI',
          value: RDF_NIL
        };
        for (var i = 0; i < list.length; ++i) {
          var item = list[i];
          var blankNode = {
            type: 'blank node',
            value: namer.getName()
          };
          triples.push({
            subject: subject,
            predicate: predicate,
            object: blankNode
          });
          subject = blankNode;
          predicate = first;
          var object = _objectToRDF(item);
          if (object) {
            triples.push({
              subject: subject,
              predicate: predicate,
              object: object
            });
          }
          predicate = rest;
        }
        triples.push({
          subject: subject,
          predicate: predicate,
          object: nil
        });
      }
      function _objectToRDF(item) {
        var object = {};
        if (_isValue(item)) {
          object.type = 'literal';
          var value = item['@value'];
          var datatype = item['@type'] || null;
          if (_isBoolean(value)) {
            object.value = value.toString();
            object.datatype = datatype || XSD_BOOLEAN;
          } else if (_isDouble(value) || datatype === XSD_DOUBLE) {
            object.value = value.toExponential(15).replace(/(\d)0*e\+?/, '$1E');
            object.datatype = datatype || XSD_DOUBLE;
          } else if (_isNumber(value)) {
            object.value = value.toFixed(0);
            object.datatype = datatype || XSD_INTEGER;
          } else if ('@language' in item) {
            object.value = value;
            object.datatype = datatype || RDF_LANGSTRING;
            object.language = item['@language'];
          } else {
            object.value = value;
            object.datatype = datatype || XSD_STRING;
          }
        } else {
          var id = _isObject(item) ? item['@id'] : item;
          object.type = (id.indexOf('_:') === 0) ? 'blank node' : 'IRI';
          object.value = id;
        }
        if (object.type === 'IRI' && !_isAbsoluteIri(object.value)) {
          return null;
        }
        return object;
      }
      function _RDFToObject(o, useNativeTypes) {
        if (o.type === 'IRI' || o.type === 'blank node') {
          return {'@id': o.value};
        }
        var rval = {'@value': o.value};
        if (o['language']) {
          rval['@language'] = o.language;
        } else {
          var type = o.datatype;
          if (!type) {
            type = XSD_STRING;
          }
          if (useNativeTypes) {
            if (type === XSD_BOOLEAN) {
              if (rval['@value'] === 'true') {
                rval['@value'] = true;
              } else if (rval['@value'] === 'false') {
                rval['@value'] = false;
              }
            } else if (_isNumeric(rval['@value'])) {
              if (type === XSD_INTEGER) {
                var i = parseInt(rval['@value']);
                if (i.toFixed(0) === rval['@value']) {
                  rval['@value'] = i;
                }
              } else if (type === XSD_DOUBLE) {
                rval['@value'] = parseFloat(rval['@value']);
              }
            }
            if ([XSD_BOOLEAN, XSD_INTEGER, XSD_DOUBLE, XSD_STRING].indexOf(type) === -1) {
              rval['@type'] = type;
            }
          } else if (type !== XSD_STRING) {
            rval['@type'] = type;
          }
        }
        return rval;
      }
      function _compareRDFTriples(t1, t2) {
        var attrs = ['subject', 'predicate', 'object'];
        for (var i = 0; i < attrs.length; ++i) {
          var attr = attrs[i];
          if (t1[attr].type !== t2[attr].type || t1[attr].value !== t2[attr].value) {
            return false;
          }
        }
        if (t1.object.language !== t2.object.language) {
          return false;
        }
        if (t1.object.datatype !== t2.object.datatype) {
          return false;
        }
        return true;
      }
      function _hashQuads(id, bnodes, namer) {
        if ('hash' in bnodes[id]) {
          return bnodes[id].hash;
        }
        var quads = bnodes[id].quads;
        var nquads = [];
        for (var i = 0; i < quads.length; ++i) {
          nquads.push(_toNQuad(quads[i], quads[i].name ? quads[i].name.value : null, id));
        }
        nquads.sort();
        var hash = bnodes[id].hash = sha1.hash(nquads);
        return hash;
      }
      function _hashPaths(id, bnodes, namer, pathNamer, callback) {
        var md = sha1.create();
        var groups = {};
        var groupHashes;
        var quads = bnodes[id].quads;
        jsonld.setImmediate(function() {
          groupNodes(0);
        });
        function groupNodes(i) {
          if (i === quads.length) {
            groupHashes = Object.keys(groups).sort();
            return hashGroup(0);
          }
          var quad = quads[i];
          var bnode = _getAdjacentBlankNodeName(quad.subject, id);
          var direction = null;
          if (bnode !== null) {
            direction = 'p';
          } else {
            bnode = _getAdjacentBlankNodeName(quad.object, id);
            if (bnode !== null) {
              direction = 'r';
            }
          }
          if (bnode !== null) {
            var name;
            if (namer.isNamed(bnode)) {
              name = namer.getName(bnode);
            } else if (pathNamer.isNamed(bnode)) {
              name = pathNamer.getName(bnode);
            } else {
              name = _hashQuads(bnode, bnodes, namer);
            }
            var md = sha1.create();
            md.update(direction);
            md.update(quad.predicate.value);
            md.update(name);
            var groupHash = md.digest();
            if (groupHash in groups) {
              groups[groupHash].push(bnode);
            } else {
              groups[groupHash] = [bnode];
            }
          }
          jsonld.setImmediate(function() {
            groupNodes(i + 1);
          });
        }
        function hashGroup(i) {
          if (i === groupHashes.length) {
            return callback(null, {
              hash: md.digest(),
              pathNamer: pathNamer
            });
          }
          var groupHash = groupHashes[i];
          md.update(groupHash);
          var chosenPath = null;
          var chosenNamer = null;
          var permutator = new Permutator(groups[groupHash]);
          jsonld.setImmediate(function() {
            permutate();
          });
          function permutate() {
            var permutation = permutator.next();
            var pathNamerCopy = pathNamer.clone();
            var path = '';
            var recurse = [];
            for (var n in permutation) {
              var bnode = permutation[n];
              if (namer.isNamed(bnode)) {
                path += namer.getName(bnode);
              } else {
                if (!pathNamerCopy.isNamed(bnode)) {
                  recurse.push(bnode);
                }
                path += pathNamerCopy.getName(bnode);
              }
              if (chosenPath !== null && path.length >= chosenPath.length && path > chosenPath) {
                return nextPermutation(true);
              }
            }
            nextRecursion(0);
            function nextRecursion(n) {
              if (n === recurse.length) {
                return nextPermutation(false);
              }
              var bnode = recurse[n];
              _hashPaths(bnode, bnodes, namer, pathNamerCopy, function(err, result) {
                if (err) {
                  return callback(err);
                }
                path += pathNamerCopy.getName(bnode) + '<' + result.hash + '>';
                pathNamerCopy = result.pathNamer;
                if (chosenPath !== null && path.length >= chosenPath.length && path > chosenPath) {
                  return nextPermutation(true);
                }
                nextRecursion(n + 1);
              });
            }
            function nextPermutation(skipped) {
              if (!skipped && (chosenPath === null || path < chosenPath)) {
                chosenPath = path;
                chosenNamer = pathNamerCopy;
              }
              if (permutator.hasNext()) {
                jsonld.setImmediate(function() {
                  permutate();
                });
              } else {
                md.update(chosenPath);
                pathNamer = chosenNamer;
                hashGroup(i + 1);
              }
            }
          }
        }
      }
      function _getAdjacentBlankNodeName(node, id) {
        return (node.type === 'blank node' && node.value !== id ? node.value : null);
      }
      function _createNodeMap(input, graphs, graph, namer, name, list) {
        if (_isArray(input)) {
          for (var i = 0; i < input.length; ++i) {
            _createNodeMap(input[i], graphs, graph, namer, undefined, list);
          }
          return ;
        }
        if (!_isObject(input)) {
          if (list) {
            list.push(input);
          }
          return ;
        }
        if (_isValue(input)) {
          if ('@type' in input) {
            var type = input['@type'];
            if (type.indexOf('_:') === 0) {
              input['@type'] = type = namer.getName(type);
            }
          }
          if (list) {
            list.push(input);
          }
          return ;
        }
        if ('@type' in input) {
          var types = input['@type'];
          for (var i = 0; i < types.length; ++i) {
            var type = types[i];
            if (type.indexOf('_:') === 0) {
              namer.getName(type);
            }
          }
        }
        if (_isUndefined(name)) {
          name = _isBlankNode(input) ? namer.getName(input['@id']) : input['@id'];
        }
        if (list) {
          list.push({'@id': name});
        }
        var subjects = graphs[graph];
        var subject = subjects[name] = subjects[name] || {};
        subject['@id'] = name;
        var properties = Object.keys(input).sort();
        for (var pi = 0; pi < properties.length; ++pi) {
          var property = properties[pi];
          if (property === '@id') {
            continue;
          }
          if (property === '@reverse') {
            var referencedNode = {'@id': name};
            var reverseMap = input['@reverse'];
            for (var reverseProperty in reverseMap) {
              var items = reverseMap[reverseProperty];
              for (var ii = 0; ii < items.length; ++ii) {
                var item = items[ii];
                var itemName = item['@id'];
                if (_isBlankNode(item)) {
                  itemName = namer.getName(itemName);
                }
                _createNodeMap(item, graphs, graph, namer, itemName);
                jsonld.addValue(subjects[itemName], reverseProperty, referencedNode, {
                  propertyIsArray: true,
                  allowDuplicate: false
                });
              }
            }
            continue;
          }
          if (property === '@graph') {
            if (!(name in graphs)) {
              graphs[name] = {};
            }
            var g = (graph === '@merged') ? graph : name;
            _createNodeMap(input[property], graphs, g, namer);
            continue;
          }
          if (property !== '@type' && _isKeyword(property)) {
            if (property === '@index' && '@index' in subject) {
              throw new JsonLdError('Invalid JSON-LD syntax; conflicting @index property detected.', 'jsonld.SyntaxError', {
                code: 'conflicting indexes',
                subject: subject
              });
            }
            subject[property] = input[property];
            continue;
          }
          var objects = input[property];
          if (property.indexOf('_:') === 0) {
            property = namer.getName(property);
          }
          if (objects.length === 0) {
            jsonld.addValue(subject, property, [], {propertyIsArray: true});
            continue;
          }
          for (var oi = 0; oi < objects.length; ++oi) {
            var o = objects[oi];
            if (property === '@type') {
              o = (o.indexOf('_:') === 0) ? namer.getName(o) : o;
            }
            if (_isSubject(o) || _isSubjectReference(o)) {
              var id = _isBlankNode(o) ? namer.getName(o['@id']) : o['@id'];
              jsonld.addValue(subject, property, {'@id': id}, {
                propertyIsArray: true,
                allowDuplicate: false
              });
              _createNodeMap(o, graphs, graph, namer, id);
            } else if (_isList(o)) {
              var _list = [];
              _createNodeMap(o['@list'], graphs, graph, namer, name, _list);
              o = {'@list': _list};
              jsonld.addValue(subject, property, o, {
                propertyIsArray: true,
                allowDuplicate: false
              });
            } else {
              _createNodeMap(o, graphs, graph, namer, name);
              jsonld.addValue(subject, property, o, {
                propertyIsArray: true,
                allowDuplicate: false
              });
            }
          }
        }
      }
      function _frame(state, subjects, frame, parent, property) {
        _validateFrame(state, frame);
        frame = frame[0];
        var matches = _filterSubjects(state, subjects, frame);
        var options = state.options;
        var embedOn = _getFrameFlag(frame, options, 'embed');
        var explicitOn = _getFrameFlag(frame, options, 'explicit');
        var ids = Object.keys(matches).sort();
        for (var idx in ids) {
          var id = ids[idx];
          if (property === null) {
            state.embeds = {};
          }
          var output = {};
          output['@id'] = id;
          var embed = {
            parent: parent,
            property: property
          };
          if (embedOn && (id in state.embeds)) {
            embedOn = false;
            var existing = state.embeds[id];
            if (_isArray(existing.parent)) {
              for (var i = 0; i < existing.parent.length; ++i) {
                if (jsonld.compareValues(output, existing.parent[i])) {
                  embedOn = true;
                  break;
                }
              }
            } else if (jsonld.hasValue(existing.parent, existing.property, output)) {
              embedOn = true;
            }
            if (embedOn) {
              _removeEmbed(state, id);
            }
          }
          if (!embedOn) {
            _addFrameOutput(state, parent, property, output);
          } else {
            state.embeds[id] = embed;
            var subject = matches[id];
            var props = Object.keys(subject).sort();
            for (var i = 0; i < props.length; i++) {
              var prop = props[i];
              if (_isKeyword(prop)) {
                output[prop] = _clone(subject[prop]);
                continue;
              }
              if (!(prop in frame)) {
                if (!explicitOn) {
                  _embedValues(state, subject, prop, output);
                }
                continue;
              }
              var objects = subject[prop];
              for (var oi = 0; oi < objects.length; ++oi) {
                var o = objects[oi];
                if (_isList(o)) {
                  var list = {'@list': []};
                  _addFrameOutput(state, output, prop, list);
                  var src = o['@list'];
                  for (var n in src) {
                    o = src[n];
                    if (_isSubjectReference(o)) {
                      _frame(state, [o['@id']], frame[prop][0]['@list'], list, '@list');
                    } else {
                      _addFrameOutput(state, list, '@list', _clone(o));
                    }
                  }
                  continue;
                }
                if (_isSubjectReference(o)) {
                  _frame(state, [o['@id']], frame[prop], output, prop);
                } else {
                  _addFrameOutput(state, output, prop, _clone(o));
                }
              }
            }
            var props = Object.keys(frame).sort();
            for (var i = 0; i < props.length; ++i) {
              var prop = props[i];
              if (_isKeyword(prop)) {
                continue;
              }
              var next = frame[prop][0];
              var omitDefaultOn = _getFrameFlag(next, options, 'omitDefault');
              if (!omitDefaultOn && !(prop in output)) {
                var preserve = '@null';
                if ('@default' in next) {
                  preserve = _clone(next['@default']);
                }
                if (!_isArray(preserve)) {
                  preserve = [preserve];
                }
                output[prop] = [{'@preserve': preserve}];
              }
            }
            _addFrameOutput(state, parent, property, output);
          }
        }
      }
      function _getFrameFlag(frame, options, name) {
        var flag = '@' + name;
        return (flag in frame) ? frame[flag][0] : options[name];
      }
      function _validateFrame(state, frame) {
        if (!_isArray(frame) || frame.length !== 1 || !_isObject(frame[0])) {
          throw new JsonLdError('Invalid JSON-LD syntax; a JSON-LD frame must be a single object.', 'jsonld.SyntaxError', {frame: frame});
        }
      }
      function _filterSubjects(state, subjects, frame) {
        var rval = {};
        for (var i = 0; i < subjects.length; ++i) {
          var id = subjects[i];
          var subject = state.subjects[id];
          if (_filterSubject(subject, frame)) {
            rval[id] = subject;
          }
        }
        return rval;
      }
      function _filterSubject(subject, frame) {
        if ('@type' in frame && !(frame['@type'].length === 1 && _isObject(frame['@type'][0]))) {
          var types = frame['@type'];
          for (var i = 0; i < types.length; ++i) {
            if (jsonld.hasValue(subject, '@type', types[i])) {
              return true;
            }
          }
          return false;
        }
        for (var key in frame) {
          if ((key === '@id' || !_isKeyword(key)) && !(key in subject)) {
            return false;
          }
        }
        return true;
      }
      function _embedValues(state, subject, property, output) {
        var objects = subject[property];
        for (var i = 0; i < objects.length; ++i) {
          var o = objects[i];
          if (_isList(o)) {
            var list = {'@list': []};
            _addFrameOutput(state, output, property, list);
            return _embedValues(state, o, '@list', list['@list']);
          }
          if (_isSubjectReference(o)) {
            var id = o['@id'];
            if (!(id in state.embeds)) {
              var embed = {
                parent: output,
                property: property
              };
              state.embeds[id] = embed;
              o = {};
              var s = state.subjects[id];
              for (var prop in s) {
                if (_isKeyword(prop)) {
                  o[prop] = _clone(s[prop]);
                  continue;
                }
                _embedValues(state, s, prop, o);
              }
            }
            _addFrameOutput(state, output, property, o);
          } else {
            _addFrameOutput(state, output, property, _clone(o));
          }
        }
      }
      function _removeEmbed(state, id) {
        var embeds = state.embeds;
        var embed = embeds[id];
        var parent = embed.parent;
        var property = embed.property;
        var subject = {'@id': id};
        if (_isArray(parent)) {
          for (var i = 0; i < parent.length; ++i) {
            if (jsonld.compareValues(parent[i], subject)) {
              parent[i] = subject;
              break;
            }
          }
        } else {
          var useArray = _isArray(parent[property]);
          jsonld.removeValue(parent, property, subject, {propertyIsArray: useArray});
          jsonld.addValue(parent, property, subject, {propertyIsArray: useArray});
        }
        var removeDependents = function(id) {
          var ids = Object.keys(embeds);
          for (var i = 0; i < ids.length; ++i) {
            var next = ids[i];
            if (next in embeds && _isObject(embeds[next].parent) && embeds[next].parent['@id'] === id) {
              delete embeds[next];
              removeDependents(next);
            }
          }
        };
        removeDependents(id);
      }
      function _addFrameOutput(state, parent, property, output) {
        if (_isObject(parent)) {
          jsonld.addValue(parent, property, output, {propertyIsArray: true});
        } else {
          parent.push(output);
        }
      }
      function _removePreserve(ctx, input, options) {
        if (_isArray(input)) {
          var output = [];
          for (var i = 0; i < input.length; ++i) {
            var result = _removePreserve(ctx, input[i], options);
            if (result !== null) {
              output.push(result);
            }
          }
          input = output;
        } else if (_isObject(input)) {
          if ('@preserve' in input) {
            if (input['@preserve'] === '@null') {
              return null;
            }
            return input['@preserve'];
          }
          if (_isValue(input)) {
            return input;
          }
          if (_isList(input)) {
            input['@list'] = _removePreserve(ctx, input['@list'], options);
            return input;
          }
          for (var prop in input) {
            var result = _removePreserve(ctx, input[prop], options);
            var container = jsonld.getContextValue(ctx, prop, '@container');
            if (options.compactArrays && _isArray(result) && result.length === 1 && container === null) {
              result = result[0];
            }
            input[prop] = result;
          }
        }
        return input;
      }
      function _compareShortestLeast(a, b) {
        if (a.length < b.length) {
          return -1;
        }
        if (b.length < a.length) {
          return 1;
        }
        if (a === b) {
          return 0;
        }
        return (a < b) ? -1 : 1;
      }
      function _selectTerm(activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue) {
        if (typeOrLanguageValue === null) {
          typeOrLanguageValue = '@null';
        }
        var prefs = [];
        if ((typeOrLanguageValue === '@id' || typeOrLanguageValue === '@reverse') && _isSubjectReference(value)) {
          if (typeOrLanguageValue === '@reverse') {
            prefs.push('@reverse');
          }
          var term = _compactIri(activeCtx, value['@id'], null, {vocab: true});
          if (term in activeCtx.mappings && activeCtx.mappings[term] && activeCtx.mappings[term]['@id'] === value['@id']) {
            prefs.push.apply(prefs, ['@vocab', '@id']);
          } else {
            prefs.push.apply(prefs, ['@id', '@vocab']);
          }
        } else {
          prefs.push(typeOrLanguageValue);
        }
        prefs.push('@none');
        var containerMap = activeCtx.inverse[iri];
        for (var ci = 0; ci < containers.length; ++ci) {
          var container = containers[ci];
          if (!(container in containerMap)) {
            continue;
          }
          var typeOrLanguageValueMap = containerMap[container][typeOrLanguage];
          for (var pi = 0; pi < prefs.length; ++pi) {
            var pref = prefs[pi];
            if (!(pref in typeOrLanguageValueMap)) {
              continue;
            }
            return typeOrLanguageValueMap[pref];
          }
        }
        return null;
      }
      function _compactIri(activeCtx, iri, value, relativeTo, reverse) {
        if (iri === null) {
          return iri;
        }
        if (_isUndefined(value)) {
          value = null;
        }
        if (_isUndefined(reverse)) {
          reverse = false;
        }
        relativeTo = relativeTo || {};
        if (_isKeyword(iri)) {
          relativeTo.vocab = true;
        }
        if (relativeTo.vocab && iri in activeCtx.getInverse()) {
          var defaultLanguage = activeCtx['@language'] || '@none';
          var containers = [];
          if (_isObject(value) && '@index' in value) {
            containers.push('@index');
          }
          var typeOrLanguage = '@language';
          var typeOrLanguageValue = '@null';
          if (reverse) {
            typeOrLanguage = '@type';
            typeOrLanguageValue = '@reverse';
            containers.push('@set');
          } else if (_isList(value)) {
            if (!('@index' in value)) {
              containers.push('@list');
            }
            var list = value['@list'];
            var commonLanguage = (list.length === 0) ? defaultLanguage : null;
            var commonType = null;
            for (var i = 0; i < list.length; ++i) {
              var item = list[i];
              var itemLanguage = '@none';
              var itemType = '@none';
              if (_isValue(item)) {
                if ('@language' in item) {
                  itemLanguage = item['@language'];
                } else if ('@type' in item) {
                  itemType = item['@type'];
                } else {
                  itemLanguage = '@null';
                }
              } else {
                itemType = '@id';
              }
              if (commonLanguage === null) {
                commonLanguage = itemLanguage;
              } else if (itemLanguage !== commonLanguage && _isValue(item)) {
                commonLanguage = '@none';
              }
              if (commonType === null) {
                commonType = itemType;
              } else if (itemType !== commonType) {
                commonType = '@none';
              }
              if (commonLanguage === '@none' && commonType === '@none') {
                break;
              }
            }
            commonLanguage = commonLanguage || '@none';
            commonType = commonType || '@none';
            if (commonType !== '@none') {
              typeOrLanguage = '@type';
              typeOrLanguageValue = commonType;
            } else {
              typeOrLanguageValue = commonLanguage;
            }
          } else {
            if (_isValue(value)) {
              if ('@language' in value && !('@index' in value)) {
                containers.push('@language');
                typeOrLanguageValue = value['@language'];
              } else if ('@type' in value) {
                typeOrLanguage = '@type';
                typeOrLanguageValue = value['@type'];
              }
            } else {
              typeOrLanguage = '@type';
              typeOrLanguageValue = '@id';
            }
            containers.push('@set');
          }
          containers.push('@none');
          var term = _selectTerm(activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue);
          if (term !== null) {
            return term;
          }
        }
        if (relativeTo.vocab) {
          if ('@vocab' in activeCtx) {
            var vocab = activeCtx['@vocab'];
            if (iri.indexOf(vocab) === 0 && iri !== vocab) {
              var suffix = iri.substr(vocab.length);
              if (!(suffix in activeCtx.mappings)) {
                return suffix;
              }
            }
          }
        }
        var choice = null;
        for (var term in activeCtx.mappings) {
          if (term.indexOf(':') !== -1) {
            continue;
          }
          var definition = activeCtx.mappings[term];
          if (!definition || definition['@id'] === iri || iri.indexOf(definition['@id']) !== 0) {
            continue;
          }
          var curie = term + ':' + iri.substr(definition['@id'].length);
          var isUsableCurie = (!(curie in activeCtx.mappings) || (value === null && activeCtx.mappings[curie] && activeCtx.mappings[curie]['@id'] === iri));
          if (isUsableCurie && (choice === null || _compareShortestLeast(curie, choice) < 0)) {
            choice = curie;
          }
        }
        if (choice !== null) {
          return choice;
        }
        if (!relativeTo.vocab) {
          return _removeBase(activeCtx['@base'], iri);
        }
        return iri;
      }
      function _compactValue(activeCtx, activeProperty, value) {
        if (_isValue(value)) {
          var type = jsonld.getContextValue(activeCtx, activeProperty, '@type');
          var language = jsonld.getContextValue(activeCtx, activeProperty, '@language');
          var container = jsonld.getContextValue(activeCtx, activeProperty, '@container');
          var preserveIndex = (('@index' in value) && container !== '@index');
          if (!preserveIndex) {
            if (value['@type'] === type || value['@language'] === language) {
              return value['@value'];
            }
          }
          var keyCount = Object.keys(value).length;
          var isValueOnlyKey = (keyCount === 1 || (keyCount === 2 && ('@index' in value) && !preserveIndex));
          var hasDefaultLanguage = ('@language' in activeCtx);
          var isValueString = _isString(value['@value']);
          var hasNullMapping = (activeCtx.mappings[activeProperty] && activeCtx.mappings[activeProperty]['@language'] === null);
          if (isValueOnlyKey && (!hasDefaultLanguage || !isValueString || hasNullMapping)) {
            return value['@value'];
          }
          var rval = {};
          if (preserveIndex) {
            rval[_compactIri(activeCtx, '@index')] = value['@index'];
          }
          if ('@type' in value) {
            rval[_compactIri(activeCtx, '@type')] = _compactIri(activeCtx, value['@type'], null, {vocab: true});
          } else if ('@language' in value) {
            rval[_compactIri(activeCtx, '@language')] = value['@language'];
          }
          rval[_compactIri(activeCtx, '@value')] = value['@value'];
          return rval;
        }
        var expandedProperty = _expandIri(activeCtx, activeProperty, {vocab: true});
        var type = jsonld.getContextValue(activeCtx, activeProperty, '@type');
        var compacted = _compactIri(activeCtx, value['@id'], null, {vocab: type === '@vocab'});
        if (type === '@id' || type === '@vocab' || expandedProperty === '@graph') {
          return compacted;
        }
        var rval = {};
        rval[_compactIri(activeCtx, '@id')] = compacted;
        return rval;
      }
      function _createTermDefinition(activeCtx, localCtx, term, defined) {
        if (term in defined) {
          if (defined[term]) {
            return ;
          }
          throw new JsonLdError('Cyclical context definition detected.', 'jsonld.CyclicalContext', {
            code: 'cyclic IRI mapping',
            context: localCtx,
            term: term
          });
        }
        defined[term] = false;
        if (_isKeyword(term)) {
          throw new JsonLdError('Invalid JSON-LD syntax; keywords cannot be overridden.', 'jsonld.SyntaxError', {
            code: 'keyword redefinition',
            context: localCtx,
            term: term
          });
        }
        if (term === '') {
          throw new JsonLdError('Invalid JSON-LD syntax; a term cannot be an empty string.', 'jsonld.SyntaxError', {
            code: 'invalid term definition',
            context: localCtx
          });
        }
        if (activeCtx.mappings[term]) {
          delete activeCtx.mappings[term];
        }
        var value = localCtx[term];
        if (value === null || (_isObject(value) && value['@id'] === null)) {
          activeCtx.mappings[term] = null;
          defined[term] = true;
          return ;
        }
        if (_isString(value)) {
          value = {'@id': value};
        }
        if (!_isObject(value)) {
          throw new JsonLdError('Invalid JSON-LD syntax; @context property values must be ' + 'strings or objects.', 'jsonld.SyntaxError', {
            code: 'invalid term definition',
            context: localCtx
          });
        }
        var mapping = activeCtx.mappings[term] = {};
        mapping.reverse = false;
        if ('@reverse' in value) {
          if ('@id' in value) {
            throw new JsonLdError('Invalid JSON-LD syntax; a @reverse term definition must not ' + 'contain @id.', 'jsonld.SyntaxError', {
              code: 'invalid reverse property',
              context: localCtx
            });
          }
          var reverse = value['@reverse'];
          if (!_isString(reverse)) {
            throw new JsonLdError('Invalid JSON-LD syntax; a @context @reverse value must be a string.', 'jsonld.SyntaxError', {
              code: 'invalid IRI mapping',
              context: localCtx
            });
          }
          var id = _expandIri(activeCtx, reverse, {
            vocab: true,
            base: false
          }, localCtx, defined);
          if (!_isAbsoluteIri(id)) {
            throw new JsonLdError('Invalid JSON-LD syntax; a @context @reverse value must be an ' + 'absolute IRI or a blank node identifier.', 'jsonld.SyntaxError', {
              code: 'invalid IRI mapping',
              context: localCtx
            });
          }
          mapping['@id'] = id;
          mapping.reverse = true;
        } else if ('@id' in value) {
          var id = value['@id'];
          if (!_isString(id)) {
            throw new JsonLdError('Invalid JSON-LD syntax; a @context @id value must be an array ' + 'of strings or a string.', 'jsonld.SyntaxError', {
              code: 'invalid IRI mapping',
              context: localCtx
            });
          }
          if (id !== term) {
            id = _expandIri(activeCtx, id, {
              vocab: true,
              base: false
            }, localCtx, defined);
            if (!_isAbsoluteIri(id) && !_isKeyword(id)) {
              throw new JsonLdError('Invalid JSON-LD syntax; a @context @id value must be an ' + 'absolute IRI, a blank node identifier, or a keyword.', 'jsonld.SyntaxError', {
                code: 'invalid IRI mapping',
                context: localCtx
              });
            }
            mapping['@id'] = id;
          }
        }
        if (!('@id' in mapping)) {
          var colon = term.indexOf(':');
          if (colon !== -1) {
            var prefix = term.substr(0, colon);
            if (prefix in localCtx) {
              _createTermDefinition(activeCtx, localCtx, prefix, defined);
            }
            if (activeCtx.mappings[prefix]) {
              var suffix = term.substr(colon + 1);
              mapping['@id'] = activeCtx.mappings[prefix]['@id'] + suffix;
            } else {
              mapping['@id'] = term;
            }
          } else {
            if (!('@vocab' in activeCtx)) {
              throw new JsonLdError('Invalid JSON-LD syntax; @context terms must define an @id.', 'jsonld.SyntaxError', {
                code: 'invalid IRI mapping',
                context: localCtx,
                term: term
              });
            }
            mapping['@id'] = activeCtx['@vocab'] + term;
          }
        }
        defined[term] = true;
        if ('@type' in value) {
          var type = value['@type'];
          if (!_isString(type)) {
            throw new JsonLdError('Invalid JSON-LD syntax; an @context @type values must be a string.', 'jsonld.SyntaxError', {
              code: 'invalid type mapping',
              context: localCtx
            });
          }
          if (type !== '@id' && type !== '@vocab') {
            type = _expandIri(activeCtx, type, {
              vocab: true,
              base: false
            }, localCtx, defined);
            if (!_isAbsoluteIri(type)) {
              throw new JsonLdError('Invalid JSON-LD syntax; an @context @type value must be an ' + 'absolute IRI.', 'jsonld.SyntaxError', {
                code: 'invalid type mapping',
                context: localCtx
              });
            }
            if (type.indexOf('_:') === 0) {
              throw new JsonLdError('Invalid JSON-LD syntax; an @context @type values must be an IRI, ' + 'not a blank node identifier.', 'jsonld.SyntaxError', {
                code: 'invalid type mapping',
                context: localCtx
              });
            }
          }
          mapping['@type'] = type;
        }
        if ('@container' in value) {
          var container = value['@container'];
          if (container !== '@list' && container !== '@set' && container !== '@index' && container !== '@language') {
            throw new JsonLdError('Invalid JSON-LD syntax; @context @container value must be ' + 'one of the following: @list, @set, @index, or @language.', 'jsonld.SyntaxError', {
              code: 'invalid container mapping',
              context: localCtx
            });
          }
          if (mapping.reverse && container !== '@index' && container !== '@set' && container !== null) {
            throw new JsonLdError('Invalid JSON-LD syntax; @context @container value for a @reverse ' + 'type definition must be @index or @set.', 'jsonld.SyntaxError', {
              code: 'invalid reverse property',
              context: localCtx
            });
          }
          mapping['@container'] = container;
        }
        if ('@language' in value && !('@type' in value)) {
          var language = value['@language'];
          if (language !== null && !_isString(language)) {
            throw new JsonLdError('Invalid JSON-LD syntax; @context @language value must be ' + 'a string or null.', 'jsonld.SyntaxError', {
              code: 'invalid language mapping',
              context: localCtx
            });
          }
          if (language !== null) {
            language = language.toLowerCase();
          }
          mapping['@language'] = language;
        }
        var id = mapping['@id'];
        if (id === '@context' || id === '@preserve') {
          throw new JsonLdError('Invalid JSON-LD syntax; @context and @preserve cannot be aliased.', 'jsonld.SyntaxError', {
            code: 'invalid keyword alias',
            context: localCtx
          });
        }
      }
      function _expandIri(activeCtx, value, relativeTo, localCtx, defined) {
        if (value === null || _isKeyword(value)) {
          return value;
        }
        if (localCtx && value in localCtx && defined[value] !== true) {
          _createTermDefinition(activeCtx, localCtx, value, defined);
        }
        relativeTo = relativeTo || {};
        if (relativeTo.vocab) {
          var mapping = activeCtx.mappings[value];
          if (mapping === null) {
            return null;
          }
          if (mapping) {
            return mapping['@id'];
          }
        }
        var colon = value.indexOf(':');
        if (colon !== -1) {
          var prefix = value.substr(0, colon);
          var suffix = value.substr(colon + 1);
          if (prefix === '_' || suffix.indexOf('//') === 0) {
            return value;
          }
          if (localCtx && prefix in localCtx) {
            _createTermDefinition(activeCtx, localCtx, prefix, defined);
          }
          var mapping = activeCtx.mappings[prefix];
          if (mapping) {
            return mapping['@id'] + suffix;
          }
          return value;
        }
        if (relativeTo.vocab && '@vocab' in activeCtx) {
          return activeCtx['@vocab'] + value;
        }
        var rval = value;
        if (relativeTo.base) {
          rval = _prependBase(activeCtx['@base'], rval);
        }
        return rval;
      }
      function _prependBase(base, iri) {
        if (base === null) {
          return iri;
        }
        if (iri.indexOf(':') !== -1) {
          return iri;
        }
        if (_isString(base)) {
          base = jsonld.url.parse(base || '');
        }
        var rel = jsonld.url.parse(iri);
        var hierPart = (base.protocol || '');
        if (rel.authority) {
          hierPart += '//' + rel.authority;
        } else if (base.href !== '') {
          hierPart += '//' + base.authority;
        }
        var path;
        if (rel.pathname.indexOf('/') === 0) {
          path = rel.pathname;
        } else {
          path = base.pathname;
          if (rel.pathname !== '') {
            path = path.substr(0, path.lastIndexOf('/') + 1);
            if (path.length > 0 && path.substr(-1) !== '/') {
              path += '/';
            }
            path += rel.pathname;
          }
        }
        path = _removeDotSegments(path, hierPart !== '');
        if (rel.query) {
          path += '?' + rel.query;
        }
        if (rel.hash) {
          path += rel.hash;
        }
        var rval = hierPart + path;
        if (rval === '') {
          rval = './';
        }
        return rval;
      }
      function _removeBase(base, iri) {
        if (base === null) {
          return iri;
        }
        if (_isString(base)) {
          base = jsonld.url.parse(base || '');
        }
        var root = '';
        if (base.href !== '') {
          root += (base.protocol || '') + '//' + base.authority;
        } else if (iri.indexOf('//')) {
          root += '//';
        }
        if (iri.indexOf(root) !== 0) {
          return iri;
        }
        var rel = jsonld.url.parse(iri.substr(root.length));
        var baseSegments = base.normalizedPath.split('/');
        var iriSegments = rel.normalizedPath.split('/');
        var last = (rel.hash || rel.query) ? 0 : 1;
        while (baseSegments.length > 0 && iriSegments.length > last) {
          if (baseSegments[0] !== iriSegments[0]) {
            break;
          }
          baseSegments.shift();
          iriSegments.shift();
        }
        var rval = '';
        if (baseSegments.length > 0) {
          baseSegments.pop();
          for (var i = 0; i < baseSegments.length; ++i) {
            rval += '../';
          }
        }
        rval += iriSegments.join('/');
        if (rel.query) {
          rval += '?' + rel.query;
        }
        if (rel.hash) {
          rval += rel.hash;
        }
        if (rval === '') {
          rval = './';
        }
        return rval;
      }
      function _getInitialContext(options) {
        var base = jsonld.url.parse(options.base || '');
        return {
          '@base': base,
          mappings: {},
          inverse: null,
          getInverse: _createInverseContext,
          clone: _cloneActiveContext
        };
        function _createInverseContext() {
          var activeCtx = this;
          if (activeCtx.inverse) {
            return activeCtx.inverse;
          }
          var inverse = activeCtx.inverse = {};
          var defaultLanguage = activeCtx['@language'] || '@none';
          var mappings = activeCtx.mappings;
          var terms = Object.keys(mappings).sort(_compareShortestLeast);
          for (var i = 0; i < terms.length; ++i) {
            var term = terms[i];
            var mapping = mappings[term];
            if (mapping === null) {
              continue;
            }
            var container = mapping['@container'] || '@none';
            var ids = mapping['@id'];
            if (!_isArray(ids)) {
              ids = [ids];
            }
            for (var ii = 0; ii < ids.length; ++ii) {
              var iri = ids[ii];
              var entry = inverse[iri];
              if (!entry) {
                inverse[iri] = entry = {};
              }
              if (!entry[container]) {
                entry[container] = {
                  '@language': {},
                  '@type': {}
                };
              }
              entry = entry[container];
              if (mapping.reverse) {
                _addPreferredTerm(mapping, term, entry['@type'], '@reverse');
              } else if ('@type' in mapping) {
                _addPreferredTerm(mapping, term, entry['@type'], mapping['@type']);
              } else if ('@language' in mapping) {
                var language = mapping['@language'] || '@null';
                _addPreferredTerm(mapping, term, entry['@language'], language);
              } else {
                _addPreferredTerm(mapping, term, entry['@language'], defaultLanguage);
                _addPreferredTerm(mapping, term, entry['@type'], '@none');
                _addPreferredTerm(mapping, term, entry['@language'], '@none');
              }
            }
          }
          return inverse;
        }
        function _addPreferredTerm(mapping, term, entry, typeOrLanguageValue) {
          if (!(typeOrLanguageValue in entry)) {
            entry[typeOrLanguageValue] = term;
          }
        }
        function _cloneActiveContext() {
          var child = {};
          child['@base'] = this['@base'];
          child.mappings = _clone(this.mappings);
          child.clone = this.clone;
          child.inverse = null;
          child.getInverse = this.getInverse;
          if ('@language' in this) {
            child['@language'] = this['@language'];
          }
          if ('@vocab' in this) {
            child['@vocab'] = this['@vocab'];
          }
          return child;
        }
      }
      function _isKeyword(v) {
        if (!_isString(v)) {
          return false;
        }
        switch (v) {
          case '@base':
          case '@context':
          case '@container':
          case '@default':
          case '@embed':
          case '@explicit':
          case '@graph':
          case '@id':
          case '@index':
          case '@language':
          case '@list':
          case '@omitDefault':
          case '@preserve':
          case '@reverse':
          case '@set':
          case '@type':
          case '@value':
          case '@vocab':
            return true;
        }
        return false;
      }
      function _isObject(v) {
        return (Object.prototype.toString.call(v) === '[object Object]');
      }
      function _isEmptyObject(v) {
        return _isObject(v) && Object.keys(v).length === 0;
      }
      function _isArray(v) {
        return Array.isArray(v);
      }
      function _validateTypeValue(v) {
        if (_isString(v) || _isEmptyObject(v)) {
          return ;
        }
        var isValid = false;
        if (_isArray(v)) {
          isValid = true;
          for (var i = 0; i < v.length; ++i) {
            if (!(_isString(v[i]))) {
              isValid = false;
              break;
            }
          }
        }
        if (!isValid) {
          throw new JsonLdError('Invalid JSON-LD syntax; "@type" value must a string, an array of ' + 'strings, or an empty object.', 'jsonld.SyntaxError', {
            code: 'invalid type value',
            value: v
          });
        }
      }
      function _isString(v) {
        return (typeof v === 'string' || Object.prototype.toString.call(v) === '[object String]');
      }
      function _isNumber(v) {
        return (typeof v === 'number' || Object.prototype.toString.call(v) === '[object Number]');
      }
      function _isDouble(v) {
        return _isNumber(v) && String(v).indexOf('.') !== -1;
      }
      function _isNumeric(v) {
        return !isNaN(parseFloat(v)) && isFinite(v);
      }
      function _isBoolean(v) {
        return (typeof v === 'boolean' || Object.prototype.toString.call(v) === '[object Boolean]');
      }
      function _isUndefined(v) {
        return (typeof v === 'undefined');
      }
      function _isSubject(v) {
        var rval = false;
        if (_isObject(v) && !(('@value' in v) || ('@set' in v) || ('@list' in v))) {
          var keyCount = Object.keys(v).length;
          rval = (keyCount > 1 || !('@id' in v));
        }
        return rval;
      }
      function _isSubjectReference(v) {
        return (_isObject(v) && Object.keys(v).length === 1 && ('@id' in v));
      }
      function _isValue(v) {
        return _isObject(v) && ('@value' in v);
      }
      function _isList(v) {
        return _isObject(v) && ('@list' in v);
      }
      function _isBlankNode(v) {
        var rval = false;
        if (_isObject(v)) {
          if ('@id' in v) {
            rval = (v['@id'].indexOf('_:') === 0);
          } else {
            rval = (Object.keys(v).length === 0 || !(('@value' in v) || ('@set' in v) || ('@list' in v)));
          }
        }
        return rval;
      }
      function _isAbsoluteIri(v) {
        return _isString(v) && v.indexOf(':') !== -1;
      }
      function _clone(value) {
        if (value && typeof value === 'object') {
          var rval;
          if (_isArray(value)) {
            rval = [];
            for (var i = 0; i < value.length; ++i) {
              rval[i] = _clone(value[i]);
            }
          } else if (_isObject(value)) {
            rval = {};
            for (var key in value) {
              rval[key] = _clone(value[key]);
            }
          } else {
            rval = value.toString();
          }
          return rval;
        }
        return value;
      }
      function _findContextUrls(input, urls, replace, base) {
        var count = Object.keys(urls).length;
        if (_isArray(input)) {
          for (var i = 0; i < input.length; ++i) {
            _findContextUrls(input[i], urls, replace, base);
          }
          return (count < Object.keys(urls).length);
        } else if (_isObject(input)) {
          for (var key in input) {
            if (key !== '@context') {
              _findContextUrls(input[key], urls, replace, base);
              continue;
            }
            var ctx = input[key];
            if (_isArray(ctx)) {
              var length = ctx.length;
              for (var i = 0; i < length; ++i) {
                var _ctx = ctx[i];
                if (_isString(_ctx)) {
                  _ctx = _prependBase(base, _ctx);
                  if (replace) {
                    _ctx = urls[_ctx];
                    if (_isArray(_ctx)) {
                      Array.prototype.splice.apply(ctx, [i, 1].concat(_ctx));
                      i += _ctx.length;
                      length += _ctx.length;
                    } else {
                      ctx[i] = _ctx;
                    }
                  } else if (!(_ctx in urls)) {
                    urls[_ctx] = false;
                  }
                }
              }
            } else if (_isString(ctx)) {
              ctx = _prependBase(base, ctx);
              if (replace) {
                input[key] = urls[ctx];
              } else if (!(ctx in urls)) {
                urls[ctx] = false;
              }
            }
          }
          return (count < Object.keys(urls).length);
        }
        return false;
      }
      function _retrieveContextUrls(input, options, callback) {
        var error = null;
        var regex = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        var documentLoader = options.documentLoader;
        var retrieve = function(input, cycles, documentLoader, base, callback) {
          if (Object.keys(cycles).length > MAX_CONTEXT_URLS) {
            error = new JsonLdError('Maximum number of @context URLs exceeded.', 'jsonld.ContextUrlError', {
              code: 'loading remote context failed',
              max: MAX_CONTEXT_URLS
            });
            return callback(error);
          }
          var urls = {};
          var finished = function() {
            _findContextUrls(input, urls, true, base);
            callback(null, input);
          };
          if (!_findContextUrls(input, urls, false, base)) {
            finished();
          }
          var queue = [];
          for (var url in urls) {
            if (urls[url] === false) {
              if (!regex.test(url)) {
                error = new JsonLdError('Malformed URL.', 'jsonld.InvalidUrl', {
                  code: 'loading remote context failed',
                  url: url
                });
                return callback(error);
              }
              queue.push(url);
            }
          }
          var count = queue.length;
          for (var i = 0; i < queue.length; ++i) {
            (function(url) {
              if (url in cycles) {
                error = new JsonLdError('Cyclical @context URLs detected.', 'jsonld.ContextUrlError', {
                  code: 'recursive context inclusion',
                  url: url
                });
                return callback(error);
              }
              var _cycles = _clone(cycles);
              _cycles[url] = true;
              var done = function(err, remoteDoc) {
                if (error) {
                  return ;
                }
                var ctx = remoteDoc ? remoteDoc.document : null;
                if (!err && _isString(ctx)) {
                  try {
                    ctx = JSON.parse(ctx);
                  } catch (ex) {
                    err = ex;
                  }
                }
                if (err) {
                  err = new JsonLdError('Dereferencing a URL did not result in a valid JSON-LD object. ' + 'Possible causes are an inaccessible URL perhaps due to ' + 'a same-origin policy (ensure the server uses CORS if you are ' + 'using client-side JavaScript), too many redirects, a ' + 'non-JSON response, or more than one HTTP Link Header was ' + 'provided for a remote context.', 'jsonld.InvalidUrl', {
                    code: 'loading remote context failed',
                    url: url,
                    cause: err
                  });
                } else if (!_isObject(ctx)) {
                  err = new JsonLdError('Dereferencing a URL did not result in a JSON object. The ' + 'response was valid JSON, but it was not a JSON object.', 'jsonld.InvalidUrl', {
                    code: 'invalid remote context',
                    url: url,
                    cause: err
                  });
                }
                if (err) {
                  error = err;
                  return callback(error);
                }
                if (!('@context' in ctx)) {
                  ctx = {'@context': {}};
                } else {
                  ctx = {'@context': ctx['@context']};
                }
                if (remoteDoc.contextUrl) {
                  if (!_isArray(ctx['@context'])) {
                    ctx['@context'] = [ctx['@context']];
                  }
                  ctx['@context'].push(remoteDoc.contextUrl);
                }
                retrieve(ctx, _cycles, documentLoader, url, function(err, ctx) {
                  if (err) {
                    return callback(err);
                  }
                  urls[url] = ctx['@context'];
                  count -= 1;
                  if (count === 0) {
                    finished();
                  }
                });
              };
              var promise = documentLoader(url, done);
              if (promise && 'then' in promise) {
                promise.then(done.bind(null, null), done);
              }
            }(queue[i]));
          }
        };
        retrieve(input, {}, documentLoader, options.base, callback);
      }
      if (!Object.keys) {
        Object.keys = function(o) {
          if (o !== Object(o)) {
            throw new TypeError('Object.keys called on non-object');
          }
          var rval = [];
          for (var p in o) {
            if (Object.prototype.hasOwnProperty.call(o, p)) {
              rval.push(p);
            }
          }
          return rval;
        };
      }
      function _parseNQuads(input) {
        var iri = '(?:<([^:]+:[^>]*)>)';
        var bnode = '(_:(?:[A-Za-z0-9]+))';
        var plain = '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"';
        var datatype = '(?:\\^\\^' + iri + ')';
        var language = '(?:@([a-z]+(?:-[a-z0-9]+)*))';
        var literal = '(?:' + plain + '(?:' + datatype + '|' + language + ')?)';
        var ws = '[ \\t]+';
        var wso = '[ \\t]*';
        var eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
        var empty = new RegExp('^' + wso + '$');
        var subject = '(?:' + iri + '|' + bnode + ')' + ws;
        var property = iri + ws;
        var object = '(?:' + iri + '|' + bnode + '|' + literal + ')' + wso;
        var graphName = '(?:\\.|(?:(?:' + iri + '|' + bnode + ')' + wso + '\\.))';
        var quad = new RegExp('^' + wso + subject + property + object + graphName + wso + '$');
        var dataset = {};
        var lines = input.split(eoln);
        var lineNumber = 0;
        for (var li = 0; li < lines.length; ++li) {
          var line = lines[li];
          lineNumber++;
          if (empty.test(line)) {
            continue;
          }
          var match = line.match(quad);
          if (match === null) {
            throw new JsonLdError('Error while parsing N-Quads; invalid quad.', 'jsonld.ParseError', {line: lineNumber});
          }
          var triple = {};
          if (!_isUndefined(match[1])) {
            triple.subject = {
              type: 'IRI',
              value: match[1]
            };
          } else {
            triple.subject = {
              type: 'blank node',
              value: match[2]
            };
          }
          triple.predicate = {
            type: 'IRI',
            value: match[3]
          };
          if (!_isUndefined(match[4])) {
            triple.object = {
              type: 'IRI',
              value: match[4]
            };
          } else if (!_isUndefined(match[5])) {
            triple.object = {
              type: 'blank node',
              value: match[5]
            };
          } else {
            triple.object = {type: 'literal'};
            if (!_isUndefined(match[7])) {
              triple.object.datatype = match[7];
            } else if (!_isUndefined(match[8])) {
              triple.object.datatype = RDF_LANGSTRING;
              triple.object.language = match[8];
            } else {
              triple.object.datatype = XSD_STRING;
            }
            var unescaped = match[6].replace(/\\"/g, '"').replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
            triple.object.value = unescaped;
          }
          var name = '@default';
          if (!_isUndefined(match[9])) {
            name = match[9];
          } else if (!_isUndefined(match[10])) {
            name = match[10];
          }
          if (!(name in dataset)) {
            dataset[name] = [triple];
          } else {
            var unique = true;
            var triples = dataset[name];
            for (var ti = 0; unique && ti < triples.length; ++ti) {
              if (_compareRDFTriples(triples[ti], triple)) {
                unique = false;
              }
            }
            if (unique) {
              triples.push(triple);
            }
          }
        }
        return dataset;
      }
      jsonld.registerRDFParser('application/nquads', _parseNQuads);
      function _toNQuads(dataset) {
        var quads = [];
        for (var graphName in dataset) {
          var triples = dataset[graphName];
          for (var ti = 0; ti < triples.length; ++ti) {
            var triple = triples[ti];
            if (graphName === '@default') {
              graphName = null;
            }
            quads.push(_toNQuad(triple, graphName));
          }
        }
        quads.sort();
        return quads.join('');
      }
      function _toNQuad(triple, graphName, bnode) {
        var s = triple.subject;
        var p = triple.predicate;
        var o = triple.object;
        var g = graphName;
        var quad = '';
        if (s.type === 'IRI') {
          quad += '<' + s.value + '>';
        } else if (bnode) {
          quad += (s.value === bnode) ? '_:a' : '_:z';
        } else {
          quad += s.value;
        }
        quad += ' ';
        if (p.type === 'IRI') {
          quad += '<' + p.value + '>';
        } else if (bnode) {
          quad += '_:p';
        } else {
          quad += p.value;
        }
        quad += ' ';
        if (o.type === 'IRI') {
          quad += '<' + o.value + '>';
        } else if (o.type === 'blank node') {
          if (bnode) {
            quad += (o.value === bnode) ? '_:a' : '_:z';
          } else {
            quad += o.value;
          }
        } else {
          var escaped = o.value.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\"/g, '\\"');
          quad += '"' + escaped + '"';
          if (o.datatype === RDF_LANGSTRING) {
            if (o.language) {
              quad += '@' + o.language;
            }
          } else if (o.datatype !== XSD_STRING) {
            quad += '^^<' + o.datatype + '>';
          }
        }
        if (g !== null) {
          if (g.indexOf('_:') !== 0) {
            quad += ' <' + g + '>';
          } else if (bnode) {
            quad += ' _:g';
          } else {
            quad += ' ' + g;
          }
        }
        quad += ' .\n';
        return quad;
      }
      function _parseRdfaApiData(data) {
        var dataset = {};
        dataset['@default'] = [];
        var subjects = data.getSubjects();
        for (var si = 0; si < subjects.length; ++si) {
          var subject = subjects[si];
          if (subject === null) {
            continue;
          }
          var triples = data.getSubjectTriples(subject);
          if (triples === null) {
            continue;
          }
          var predicates = triples.predicates;
          for (var predicate in predicates) {
            var objects = predicates[predicate].objects;
            for (var oi = 0; oi < objects.length; ++oi) {
              var object = objects[oi];
              var triple = {};
              if (subject.indexOf('_:') === 0) {
                triple.subject = {
                  type: 'blank node',
                  value: subject
                };
              } else {
                triple.subject = {
                  type: 'IRI',
                  value: subject
                };
              }
              if (predicate.indexOf('_:') === 0) {
                triple.predicate = {
                  type: 'blank node',
                  value: predicate
                };
              } else {
                triple.predicate = {
                  type: 'IRI',
                  value: predicate
                };
              }
              var value = object.value;
              if (object.type === RDF_XML_LITERAL) {
                if (!XMLSerializer) {
                  _defineXMLSerializer();
                }
                var serializer = new XMLSerializer();
                value = '';
                for (var x = 0; x < object.value.length; x++) {
                  if (object.value[x].nodeType === Node.ELEMENT_NODE) {
                    value += serializer.serializeToString(object.value[x]);
                  } else if (object.value[x].nodeType === Node.TEXT_NODE) {
                    value += object.value[x].nodeValue;
                  }
                }
              }
              triple.object = {};
              if (object.type === RDF_OBJECT) {
                if (object.value.indexOf('_:') === 0) {
                  triple.object.type = 'blank node';
                } else {
                  triple.object.type = 'IRI';
                }
              } else {
                triple.object.type = 'literal';
                if (object.type === RDF_PLAIN_LITERAL) {
                  if (object.language) {
                    triple.object.datatype = RDF_LANGSTRING;
                    triple.object.language = object.language;
                  } else {
                    triple.object.datatype = XSD_STRING;
                  }
                } else {
                  triple.object.datatype = object.type;
                }
              }
              triple.object.value = value;
              dataset['@default'].push(triple);
            }
          }
        }
        return dataset;
      }
      jsonld.registerRDFParser('rdfa-api', _parseRdfaApiData);
      function UniqueNamer(prefix) {
        this.prefix = prefix;
        this.counter = 0;
        this.existing = {};
      }
      UniqueNamer.prototype.clone = function() {
        var copy = new UniqueNamer(this.prefix);
        copy.counter = this.counter;
        copy.existing = _clone(this.existing);
        return copy;
      };
      UniqueNamer.prototype.getName = function(oldName) {
        if (oldName && oldName in this.existing) {
          return this.existing[oldName];
        }
        var name = this.prefix + this.counter;
        this.counter += 1;
        if (oldName) {
          this.existing[oldName] = name;
        }
        return name;
      };
      UniqueNamer.prototype.isNamed = function(oldName) {
        return (oldName in this.existing);
      };
      var Permutator = function(list) {
        this.list = list.sort();
        this.done = false;
        this.left = {};
        for (var i = 0; i < list.length; ++i) {
          this.left[list[i]] = true;
        }
      };
      Permutator.prototype.hasNext = function() {
        return !this.done;
      };
      Permutator.prototype.next = function() {
        var rval = this.list.slice();
        var k = null;
        var pos = 0;
        var length = this.list.length;
        for (var i = 0; i < length; ++i) {
          var element = this.list[i];
          var left = this.left[element];
          if ((k === null || element > k) && ((left && i > 0 && element > this.list[i - 1]) || (!left && i < (length - 1) && element > this.list[i + 1]))) {
            k = element;
            pos = i;
          }
        }
        if (k === null) {
          this.done = true;
        } else {
          var swap = this.left[k] ? pos - 1 : pos + 1;
          this.list[pos] = this.list[swap];
          this.list[swap] = k;
          for (var i = 0; i < length; ++i) {
            if (this.list[i] > k) {
              this.left[this.list[i]] = !this.left[this.list[i]];
            }
          }
        }
        return rval;
      };
      var sha1 = jsonld.sha1 = {};
      if (_nodejs) {
        var crypto = require("crypto");
        sha1.create = function() {
          var md = crypto.createHash('sha1');
          return {
            update: function(data) {
              md.update(data, 'utf8');
            },
            digest: function() {
              return md.digest('hex');
            }
          };
        };
      } else {
        sha1.create = function() {
          return new sha1.MessageDigest();
        };
      }
      sha1.hash = function(nquads) {
        var md = sha1.create();
        for (var i = 0; i < nquads.length; ++i) {
          md.update(nquads[i]);
        }
        return md.digest();
      };
      if (!_nodejs) {
        sha1.Buffer = function() {
          this.data = '';
          this.read = 0;
        };
        sha1.Buffer.prototype.putInt32 = function(i) {
          this.data += (String.fromCharCode(i >> 24 & 0xFF) + String.fromCharCode(i >> 16 & 0xFF) + String.fromCharCode(i >> 8 & 0xFF) + String.fromCharCode(i & 0xFF));
        };
        sha1.Buffer.prototype.getInt32 = function() {
          var rval = (this.data.charCodeAt(this.read) << 24 ^ this.data.charCodeAt(this.read + 1) << 16 ^ this.data.charCodeAt(this.read + 2) << 8 ^ this.data.charCodeAt(this.read + 3));
          this.read += 4;
          return rval;
        };
        sha1.Buffer.prototype.bytes = function() {
          return this.data.slice(this.read);
        };
        sha1.Buffer.prototype.length = function() {
          return this.data.length - this.read;
        };
        sha1.Buffer.prototype.compact = function() {
          this.data = this.data.slice(this.read);
          this.read = 0;
        };
        sha1.Buffer.prototype.toHex = function() {
          var rval = '';
          for (var i = this.read; i < this.data.length; ++i) {
            var b = this.data.charCodeAt(i);
            if (b < 16) {
              rval += '0';
            }
            rval += b.toString(16);
          }
          return rval;
        };
        sha1.MessageDigest = function() {
          if (!_sha1.initialized) {
            _sha1.init();
          }
          this.blockLength = 64;
          this.digestLength = 20;
          this.messageLength = 0;
          this.input = new sha1.Buffer();
          this.words = new Array(80);
          this.state = {
            h0: 0x67452301,
            h1: 0xEFCDAB89,
            h2: 0x98BADCFE,
            h3: 0x10325476,
            h4: 0xC3D2E1F0
          };
        };
        sha1.MessageDigest.prototype.update = function(msg) {
          msg = unescape(encodeURIComponent(msg));
          this.messageLength += msg.length;
          this.input.data += msg;
          _sha1.update(this.state, this.words, this.input);
          if (this.input.read > 2048 || this.input.length() === 0) {
            this.input.compact();
          }
        };
        sha1.MessageDigest.prototype.digest = function() {
          var len = this.messageLength;
          var padBytes = new sha1.Buffer();
          padBytes.data += this.input.bytes();
          padBytes.data += _sha1.padding.substr(0, 64 - ((len + 8) % 64));
          padBytes.putInt32((len >>> 29) & 0xFF);
          padBytes.putInt32((len << 3) & 0xFFFFFFFF);
          _sha1.update(this.state, this.words, padBytes);
          var rval = new sha1.Buffer();
          rval.putInt32(this.state.h0);
          rval.putInt32(this.state.h1);
          rval.putInt32(this.state.h2);
          rval.putInt32(this.state.h3);
          rval.putInt32(this.state.h4);
          return rval.toHex();
        };
        var _sha1 = {
          padding: null,
          initialized: false
        };
        _sha1.init = function() {
          _sha1.padding = String.fromCharCode(128);
          var c = String.fromCharCode(0x00);
          var n = 64;
          while (n > 0) {
            if (n & 1) {
              _sha1.padding += c;
            }
            n >>>= 1;
            if (n > 0) {
              c += c;
            }
          }
          _sha1.initialized = true;
        };
        _sha1.update = function(s, w, input) {
          var t,
              a,
              b,
              c,
              d,
              e,
              f,
              i;
          var len = input.length();
          while (len >= 64) {
            a = s.h0;
            b = s.h1;
            c = s.h2;
            d = s.h3;
            e = s.h4;
            for (i = 0; i < 16; ++i) {
              t = input.getInt32();
              w[i] = t;
              f = d ^ (b & (c ^ d));
              t = ((a << 5) | (a >>> 27)) + f + e + 0x5A827999 + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            for (; i < 20; ++i) {
              t = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]);
              t = (t << 1) | (t >>> 31);
              w[i] = t;
              f = d ^ (b & (c ^ d));
              t = ((a << 5) | (a >>> 27)) + f + e + 0x5A827999 + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            for (; i < 32; ++i) {
              t = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]);
              t = (t << 1) | (t >>> 31);
              w[i] = t;
              f = b ^ c ^ d;
              t = ((a << 5) | (a >>> 27)) + f + e + 0x6ED9EBA1 + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            for (; i < 40; ++i) {
              t = (w[i - 6] ^ w[i - 16] ^ w[i - 28] ^ w[i - 32]);
              t = (t << 2) | (t >>> 30);
              w[i] = t;
              f = b ^ c ^ d;
              t = ((a << 5) | (a >>> 27)) + f + e + 0x6ED9EBA1 + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            for (; i < 60; ++i) {
              t = (w[i - 6] ^ w[i - 16] ^ w[i - 28] ^ w[i - 32]);
              t = (t << 2) | (t >>> 30);
              w[i] = t;
              f = (b & c) | (d & (b ^ c));
              t = ((a << 5) | (a >>> 27)) + f + e + 0x8F1BBCDC + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            for (; i < 80; ++i) {
              t = (w[i - 6] ^ w[i - 16] ^ w[i - 28] ^ w[i - 32]);
              t = (t << 2) | (t >>> 30);
              w[i] = t;
              f = b ^ c ^ d;
              t = ((a << 5) | (a >>> 27)) + f + e + 0xCA62C1D6 + t;
              e = d;
              d = c;
              c = (b << 30) | (b >>> 2);
              b = a;
              a = t;
            }
            s.h0 += a;
            s.h1 += b;
            s.h2 += c;
            s.h3 += d;
            s.h4 += e;
            len -= 64;
          }
        };
      }
      if (!XMLSerializer) {
        var _defineXMLSerializer = function() {
          XMLSerializer = require("xmldom").XMLSerializer;
        };
      }
      jsonld.url = {};
      if (_nodejs) {
        var parse = require("url").parse;
        jsonld.url.parse = function(url) {
          var parsed = parse(url);
          parsed.pathname = parsed.pathname || '';
          _parseAuthority(parsed);
          parsed.normalizedPath = _removeDotSegments(parsed.pathname, parsed.authority !== '');
          return parsed;
        };
      } else {
        var parseUri = {};
        parseUri.options = {
          key: ['href', 'protocol', 'host', 'auth', 'user', 'password', 'hostname', 'port', 'relative', 'path', 'directory', 'file', 'query', 'hash'],
          parser: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
        };
        jsonld.url.parse = function(str) {
          var o = parseUri.options;
          var m = o.parser.exec(str);
          var uri = {};
          var i = 14;
          while (i--) {
            uri[o.key[i]] = m[i] || '';
          }
          if (uri.host && uri.path === '') {
            uri.path = '/';
          }
          uri.pathname = uri.path || '';
          _parseAuthority(uri);
          uri.normalizedPath = _removeDotSegments(uri.pathname, uri.authority !== '');
          if (uri.query) {
            uri.path = uri.path + '?' + uri.query;
          }
          if (uri.protocol) {
            uri.protocol += ':';
          }
          if (uri.hash) {
            uri.hash = '#' + uri.hash;
          }
          return uri;
        };
      }
      function _parseAuthority(parsed) {
        if (parsed.href.indexOf(':') === -1 && parsed.href.indexOf('//') === 0 && !parsed.host) {
          parsed.pathname = parsed.pathname.substr(2);
          var idx = parsed.pathname.indexOf('/');
          if (idx === -1) {
            parsed.authority = parsed.pathname;
            parsed.pathname = '';
          } else {
            parsed.authority = parsed.pathname.substr(0, idx);
            parsed.pathname = parsed.pathname.substr(idx);
          }
        } else {
          parsed.authority = parsed.host || '';
          if (parsed.auth) {
            parsed.authority = parsed.auth + '@' + parsed.authority;
          }
        }
      }
      function _removeDotSegments(path, hasAuthority) {
        var rval = '';
        if (path.indexOf('/') === 0) {
          rval = '/';
        }
        var input = path.split('/');
        var output = [];
        while (input.length > 0) {
          if (input[0] === '.' || (input[0] === '' && input.length > 1)) {
            input.shift();
            continue;
          }
          if (input[0] === '..') {
            input.shift();
            if (hasAuthority || (output.length > 0 && output[output.length - 1] !== '..')) {
              output.pop();
            } else {
              output.push('..');
            }
            continue;
          }
          output.push(input.shift());
        }
        return rval + output.join('/');
      }
      if (_nodejs) {
        jsonld.useDocumentLoader('node');
      } else if (typeof XMLHttpRequest !== 'undefined') {
        jsonld.useDocumentLoader('xhr');
      }
      if (_nodejs) {
        jsonld.use = function(extension) {
          switch (extension) {
            case 'request':
              jsonld.request = require("../browser/ignore");
              break;
            default:
              throw new JsonLdError('Unknown extension.', 'jsonld.UnknownExtension', {extension: extension});
          }
        };
      }
      return jsonld;
    };
    var factory = function() {
      return wrapper(function() {
        return factory();
      });
    };
    wrapper(factory);
    if (_nodejs) {
      module.exports = factory;
    } else if (typeof define === 'function' && define.amd) {
      define([], function() {
        return factory;
      });
    } else if (_browser) {
      if (typeof jsonld === 'undefined') {
        jsonld = jsonldjs = factory;
      } else {
        jsonldjs = factory;
      }
    }
  })();
})(require("process"));
