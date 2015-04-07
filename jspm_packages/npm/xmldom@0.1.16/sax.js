/* */ 
(function(process) {
  var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
  var nameChar = new RegExp("[\\-\\.0-9" + nameStartChar.source.slice(1, -1) + "\u00B7\u0300-\u036F\\ux203F-\u2040]");
  var tagNamePattern = new RegExp('^' + nameStartChar.source + nameChar.source + '*(?:\:' + nameStartChar.source + nameChar.source + '*)?$');
  var S_TAG = 0;
  var S_ATTR = 1;
  var S_ATTR_S = 2;
  var S_EQ = 3;
  var S_V = 4;
  var S_E = 5;
  var S_S = 6;
  var S_C = 7;
  function XMLReader() {}
  XMLReader.prototype = {parse: function(source, defaultNSMap, entityMap) {
      var domBuilder = this.domBuilder;
      domBuilder.startDocument();
      _copy(defaultNSMap, defaultNSMap = {});
      parse(source, defaultNSMap, entityMap, domBuilder, this.errorHandler);
      domBuilder.endDocument();
    }};
  function parse(source, defaultNSMapCopy, entityMap, domBuilder, errorHandler) {
    function fixedFromCharCode(code) {
      if (code > 0xffff) {
        code -= 0x10000;
        var surrogate1 = 0xd800 + (code >> 10),
            surrogate2 = 0xdc00 + (code & 0x3ff);
        return String.fromCharCode(surrogate1, surrogate2);
      } else {
        return String.fromCharCode(code);
      }
    }
    function entityReplacer(a) {
      var k = a.slice(1, -1);
      if (k in entityMap) {
        return entityMap[k];
      } else if (k.charAt(0) === '#') {
        return fixedFromCharCode(parseInt(k.substr(1).replace('x', '0x')));
      } else {
        errorHandler.error('entity not found:' + a);
        return a;
      }
    }
    function appendText(end) {
      var xt = source.substring(start, end).replace(/&#?\w+;/g, entityReplacer);
      locator && position(start);
      domBuilder.characters(xt, 0, end - start);
      start = end;
    }
    function position(start, m) {
      while (start >= endPos && (m = linePattern.exec(source))) {
        startPos = m.index;
        endPos = startPos + m[0].length;
        locator.lineNumber++;
      }
      locator.columnNumber = start - startPos + 1;
    }
    var startPos = 0;
    var endPos = 0;
    var linePattern = /.+(?:\r\n?|\n)|.*$/g;
    var locator = domBuilder.locator;
    var parseStack = [{currentNSMap: defaultNSMapCopy}];
    var closeMap = {};
    var start = 0;
    while (true) {
      var i = source.indexOf('<', start);
      if (i > start) {
        appendText(i);
      }
      switch (source.charAt(i + 1)) {
        case '/':
          var end = source.indexOf('>', i + 3);
          var tagName = source.substring(i + 2, end);
          var config = parseStack.pop();
          var localNSMap = config.localNSMap;
          if (config.tagName != tagName) {
            errorHandler.fatalError("end tag name: " + tagName + ' is not match the current start tagName:' + config.tagName);
          }
          domBuilder.endElement(config.uri, config.localName, tagName);
          if (localNSMap) {
            for (var prefix in localNSMap) {
              domBuilder.endPrefixMapping(prefix);
            }
          }
          end++;
          break;
        case '?':
          locator && position(i);
          end = parseInstruction(source, i, domBuilder);
          break;
        case '!':
          locator && position(i);
          end = parseDCC(source, i, domBuilder);
          break;
        default:
          if (i < 0) {
            if (!source.substr(start).match(/^\s*$/)) {
              errorHandler.error('source code out of document root');
            }
            return ;
          } else {
            try {
              locator && position(i);
              var el = new ElementAttributes();
              var end = parseElementStartPart(source, i, el, entityReplacer, errorHandler);
              var len = el.length;
              if (len && locator) {
                var backup = copyLocator(locator, {});
                for (var i = 0; i < len; i++) {
                  var a = el[i];
                  position(a.offset);
                  a.offset = copyLocator(locator, {});
                }
                copyLocator(backup, locator);
              }
              el.closed = el.closed || fixSelfClosed(source, end, el.tagName, closeMap);
              appendElement(el, domBuilder, parseStack);
              if (el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed) {
                end = parseHtmlSpecialContent(source, end, el.tagName, entityReplacer, domBuilder);
              } else {
                end++;
              }
            } catch (e) {
              errorHandler.error('element parse error: ' + e);
              end = -1;
            }
          }
      }
      if (end < 0) {
        appendText(i + 1);
      } else {
        start = end;
      }
    }
  }
  function copyLocator(f, t) {
    t.lineNumber = f.lineNumber;
    t.columnNumber = f.columnNumber;
    return t;
  }
  function parseElementStartPart(source, start, el, entityReplacer, errorHandler) {
    var attrName;
    var value;
    var p = ++start;
    var s = S_TAG;
    while (true) {
      var c = source.charAt(p);
      switch (c) {
        case '=':
          if (s === S_ATTR) {
            attrName = source.slice(start, p);
            s = S_EQ;
          } else if (s === S_ATTR_S) {
            s = S_EQ;
          } else {
            throw new Error('attribute equal must after attrName');
          }
          break;
        case '\'':
        case '"':
          if (s === S_EQ) {
            start = p + 1;
            p = source.indexOf(c, start);
            if (p > 0) {
              value = source.slice(start, p).replace(/&#?\w+;/g, entityReplacer);
              el.add(attrName, value, start - 1);
              s = S_E;
            } else {
              throw new Error('attribute value no end \'' + c + '\' match');
            }
          } else if (s == S_V) {
            value = source.slice(start, p).replace(/&#?\w+;/g, entityReplacer);
            el.add(attrName, value, start);
            errorHandler.warning('attribute "' + attrName + '" missed start quot(' + c + ')!!');
            start = p + 1;
            s = S_E;
          } else {
            throw new Error('attribute value must after "="');
          }
          break;
        case '/':
          switch (s) {
            case S_TAG:
              el.setTagName(source.slice(start, p));
            case S_E:
            case S_S:
            case S_C:
              s = S_C;
              el.closed = true;
            case S_V:
            case S_ATTR:
            case S_ATTR_S:
              break;
            default:
              throw new Error("attribute invalid close char('/')");
          }
          break;
        case '>':
          switch (s) {
            case S_TAG:
              el.setTagName(source.slice(start, p));
            case S_E:
            case S_S:
            case S_C:
              break;
            case S_V:
            case S_ATTR:
              value = source.slice(start, p);
              if (value.slice(-1) === '/') {
                el.closed = true;
                value = value.slice(0, -1);
              }
            case S_ATTR_S:
              if (s === S_ATTR_S) {
                value = attrName;
              }
              if (s == S_V) {
                errorHandler.warning('attribute "' + value + '" missed quot(")!!');
                el.add(attrName, value.replace(/&#?\w+;/g, entityReplacer), start);
              } else {
                errorHandler.warning('attribute "' + value + '" missed value!! "' + value + '" instead!!');
                el.add(value, value, start);
              }
              break;
            case S_EQ:
              throw new Error('attribute value missed!!');
          }
          return p;
        case '\u0080':
          c = ' ';
        default:
          if (c <= ' ') {
            switch (s) {
              case S_TAG:
                el.setTagName(source.slice(start, p));
                s = S_S;
                break;
              case S_ATTR:
                attrName = source.slice(start, p);
                s = S_ATTR_S;
                break;
              case S_V:
                var value = source.slice(start, p).replace(/&#?\w+;/g, entityReplacer);
                errorHandler.warning('attribute "' + value + '" missed quot(")!!');
                el.add(attrName, value, start);
              case S_E:
                s = S_S;
                break;
            }
          } else {
            switch (s) {
              case S_ATTR_S:
                errorHandler.warning('attribute "' + attrName + '" missed value!! "' + attrName + '" instead!!');
                el.add(attrName, attrName, start);
                start = p;
                s = S_ATTR;
                break;
              case S_E:
                errorHandler.warning('attribute space is required"' + attrName + '"!!');
              case S_S:
                s = S_ATTR;
                start = p;
                break;
              case S_EQ:
                s = S_V;
                start = p;
                break;
              case S_C:
                throw new Error("elements closed character '/' and '>' must be connected to");
            }
          }
      }
      p++;
    }
  }
  function appendElement(el, domBuilder, parseStack) {
    var tagName = el.tagName;
    var localNSMap = null;
    var currentNSMap = parseStack[parseStack.length - 1].currentNSMap;
    var i = el.length;
    while (i--) {
      var a = el[i];
      var qName = a.qName;
      var value = a.value;
      var nsp = qName.indexOf(':');
      if (nsp > 0) {
        var prefix = a.prefix = qName.slice(0, nsp);
        var localName = qName.slice(nsp + 1);
        var nsPrefix = prefix === 'xmlns' && localName;
      } else {
        localName = qName;
        prefix = null;
        nsPrefix = qName === 'xmlns' && '';
      }
      a.localName = localName;
      if (nsPrefix !== false) {
        if (localNSMap == null) {
          localNSMap = {};
          _copy(currentNSMap, currentNSMap = {});
        }
        currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
        a.uri = 'http://www.w3.org/2000/xmlns/';
        domBuilder.startPrefixMapping(nsPrefix, value);
      }
    }
    var i = el.length;
    while (i--) {
      a = el[i];
      var prefix = a.prefix;
      if (prefix) {
        if (prefix === 'xml') {
          a.uri = 'http://www.w3.org/XML/1998/namespace';
        }
        if (prefix !== 'xmlns') {
          a.uri = currentNSMap[prefix];
        }
      }
    }
    var nsp = tagName.indexOf(':');
    if (nsp > 0) {
      prefix = el.prefix = tagName.slice(0, nsp);
      localName = el.localName = tagName.slice(nsp + 1);
    } else {
      prefix = null;
      localName = el.localName = tagName;
    }
    var ns = el.uri = currentNSMap[prefix || ''];
    domBuilder.startElement(ns, localName, tagName, el);
    if (el.closed) {
      domBuilder.endElement(ns, localName, tagName);
      if (localNSMap) {
        for (prefix in localNSMap) {
          domBuilder.endPrefixMapping(prefix);
        }
      }
    } else {
      el.currentNSMap = currentNSMap;
      el.localNSMap = localNSMap;
      parseStack.push(el);
    }
  }
  function parseHtmlSpecialContent(source, elStartEnd, tagName, entityReplacer, domBuilder) {
    if (/^(?:script|textarea)$/i.test(tagName)) {
      var elEndStart = source.indexOf('</' + tagName + '>', elStartEnd);
      var text = source.substring(elStartEnd + 1, elEndStart);
      if (/[&<]/.test(text)) {
        if (/^script$/i.test(tagName)) {
          domBuilder.characters(text, 0, text.length);
          return elEndStart;
        }
        text = text.replace(/&#?\w+;/g, entityReplacer);
        domBuilder.characters(text, 0, text.length);
        return elEndStart;
      }
    }
    return elStartEnd + 1;
  }
  function fixSelfClosed(source, elStartEnd, tagName, closeMap) {
    var pos = closeMap[tagName];
    if (pos == null) {
      pos = closeMap[tagName] = source.lastIndexOf('</' + tagName + '>');
    }
    return pos < elStartEnd;
  }
  function _copy(source, target) {
    for (var n in source) {
      target[n] = source[n];
    }
  }
  function parseDCC(source, start, domBuilder) {
    var next = source.charAt(start + 2);
    switch (next) {
      case '-':
        if (source.charAt(start + 3) === '-') {
          var end = source.indexOf('-->', start + 4);
          domBuilder.comment(source, start + 4, end - start - 4);
          return end + 3;
        } else {
          return -1;
        }
      default:
        if (source.substr(start + 3, 6) == 'CDATA[') {
          var end = source.indexOf(']]>', start + 9);
          domBuilder.startCDATA();
          domBuilder.characters(source, start + 9, end - start - 9);
          domBuilder.endCDATA();
          return end + 3;
        }
        var matchs = split(source, start);
        var len = matchs.length;
        if (len > 1 && /!doctype/i.test(matchs[0][0])) {
          var name = matchs[1][0];
          var pubid = len > 3 && /^public$/i.test(matchs[2][0]) && matchs[3][0];
          var sysid = len > 4 && matchs[4][0];
          var lastMatch = matchs[len - 1];
          domBuilder.startDTD(name, pubid, sysid);
          domBuilder.endDTD();
          return lastMatch.index + lastMatch[0].length;
        }
    }
    return -1;
  }
  function parseInstruction(source, start, domBuilder) {
    var end = source.indexOf('?>', start);
    if (end) {
      var match = source.substring(start, end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
      if (match) {
        var len = match[0].length;
        domBuilder.processingInstruction(match[1], match[2]);
        return end + 2;
      } else {
        return -1;
      }
    }
    return -1;
  }
  function ElementAttributes(source) {}
  ElementAttributes.prototype = {
    setTagName: function(tagName) {
      if (!tagNamePattern.test(tagName)) {
        throw new Error('invalid tagName:' + tagName);
      }
      this.tagName = tagName;
    },
    add: function(qName, value, offset) {
      if (!tagNamePattern.test(qName)) {
        throw new Error('invalid attribute:' + qName);
      }
      this[this.length++] = {
        qName: qName,
        value: value,
        offset: offset
      };
    },
    length: 0,
    getLocalName: function(i) {
      return this[i].localName;
    },
    getOffset: function(i) {
      return this[i].offset;
    },
    getQName: function(i) {
      return this[i].qName;
    },
    getURI: function(i) {
      return this[i].uri;
    },
    getValue: function(i) {
      return this[i].value;
    }
  };
  function _set_proto_(thiz, parent) {
    thiz.__proto__ = parent;
    return thiz;
  }
  if (!(_set_proto_({}, _set_proto_.prototype) instanceof _set_proto_)) {
    _set_proto_ = function(thiz, parent) {
      function p() {}
      ;
      p.prototype = parent;
      p = new p();
      for (parent in thiz) {
        p[parent] = thiz[parent];
      }
      return p;
    };
  }
  function split(source, start) {
    var match;
    var buf = [];
    var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
    reg.lastIndex = start;
    reg.exec(source);
    while (match = reg.exec(source)) {
      buf.push(match);
      if (match[1])
        return buf;
    }
  }
  if (typeof require == 'function') {
    exports.XMLReader = XMLReader;
  }
  if (typeof require == 'function') {
    exports.XMLReader = XMLReader;
  }
})(require("process"));
