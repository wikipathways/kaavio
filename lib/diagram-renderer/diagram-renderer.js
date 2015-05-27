var _ = require('lodash');
var fs = require('fs');
var highland = require('highland');
var Highlighter = require('../highlighter/highlighter.js');
var insertCss = require('insert-css');
var RendererSvg = require('./renderer-svg');
var Selector = require('./selector');
var InfoBox = require('./info-box');
var PublicationXref = require('./publication-xref');
var SvgPanZoom = require('svg-pan-zoom');

var css = [
  fs.readFileSync(__dirname + '/pan-zoom.css')
];

module.exports = function renderer() {

  css.map(insertCss);

  /**
   * Ask renderer to remove everything what is rendered
   * Useful when rendering a specific type or source failed and next one will be tried
   *
   * @param {Object} kaavio kaavio instance Object
   * @return {boolean} success state
   */
  function destroyRender(kaavio, sourceData) {
    // TODO
    return true
  }

  /**
   * Renders a given sourceData object
   * @param  {Object} kaavio kaavio private Instance Object
   */
  function render(kaavio) {
    var sourceData = kaavio.sourceData;
    var renderer = RendererSvg.init(kaavio)
    sourceData.selector =
        Selector.init(kaavio.sourceData.pvjson.elements, renderer)

    var containerElement = kaavio.containerElement;

    // TODO refactor this to make sure it works multi-instance
    kaavio.diagramContainerElement = kaavio.diagramContainerElement ||
        containerElement.querySelector('.diagram-container');
    var diagramContainerElement = kaavio.diagramContainerElement;

    var viewport = kaavio.$element.select('g.viewport')

    // InfoBox
    InfoBox.render(viewport, kaavio.sourceData.pvjson);

    // Publication Xref
    var elementsWithPublicationXrefs = kaavio.sourceData.pvjson.elements
    .filter(function(element) {return !!element.xrefs;});

    if (elementsWithPublicationXrefs.length > 0) {
      elementsWithPublicationXrefs.forEach(
          function(elementWithPublicationXrefs) {
        PublicationXref.render(kaavio, viewport, elementWithPublicationXrefs);
      });
    }

    // Svg-pan-zoom
    // Should come last as it is fitting and centering viewport
    var svgSelection = d3.select('#' + 'kaavio-diagram-' + kaavio.instanceId);
    var svgElement = svgSelection[0][0];
    var svgPanZoom = SvgPanZoom(svgElement, {
      controlIconsEnabled: true,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 20.0,
      zoomEnabled: false,
      onZoom: function(scale) {
        kaavio.trigger('zoomed.renderer', scale)
      },
      onPan: function(x, y) {
        kaavio.trigger('panned.renderer', {x: x, y: y})
      }
    });

    /*
    // TODO can we get rid of this code now? --AR
    // Adjust viewport position
    // TODO replace magic numbers (14 and 10)
    svgPanZoom.zoomBy(0.95)
    svgPanZoom.panBy({x: -14 * svgPanZoom.getZoom(), y: -10 * svgPanZoom.getZoom()})
    //*/

    var svgInFocus = false
    svgSelection
    .on('click', function(d, i) {
      svgPanZoom.enableZoom()
      svgInFocus = true
    })
    .on('mouseenter mousemove', function(d, i) {
      if (svgInFocus) {
        svgPanZoom.enableZoom()
      }
    })
    .on('mouseleave', function(d, i) {
      if (svgInFocus) {
        svgPanZoom.disableZoom()
        svgInFocus = false
      }
    });

    // Expose panZoom to other objects
    kaavio.panZoom = svgPanZoom;

    // Make SVG resizable
    kaavio.panZoom.resizeDiagram = function() {
      svgElement.setAttribute('width', diagramContainerElement.clientWidth)
      svgElement.setAttribute('height',
          diagramContainerElement.clientHeight)

      svgPanZoom.updateBBox();
      svgPanZoom.resize();
      svgPanZoom.fit();
      svgPanZoom.center();
    };

    // TODO can we delete this?
    //kaavio.panZoom.resizeDiagram();

    kaavio.highlighter = new Highlighter(kaavio, kaavio.options);

    //kaavio.diagramComponent.vm.selection(new kaavio.diagramComponent.Selection());

    var highlightEntitiesList = kaavio.options.highlights;

    if (!!highlightEntitiesList && highlightEntitiesList.length !== 0) {
      highlightEntitiesList.map(function(entity) {
        var selector = entity.selector;
        var selectorMatch = _.isString(selector) && selector.match(/xref:id:(.*)\,(.*)/);
        if (selectorMatch) {
          var dbName = selectorMatch[2];
          var dbId = selectorMatch[1];
          var entityReferenceId = kaavio.sourceData.pvjson.elements
          /*
          .filter(function(element) {
            return !!element.isDataItemIn;
          })
          .filter(function(element) {
            return element.isDataItemIn.dbName === dbName && element.isDataItemIn.dbId === dbId;
          })
          //*/
          /*
          .filter(function(element) {
            return element.dbName === dbName && element.dbId === dbId;
          })
          //*/
          .filter(function(element) {
            var iriRegex = new RegExp('^http:\/\/.*' + dbId + '.*')
            return element.id && iriRegex.test(element.id);
          })
          .map(function(entity) {
            //return entity['@id'];
            return entity.id;
          })[0];
          entity.selector = 'xref:id:' + entityReferenceId;
        }

        return entity;
      }).forEach(function(entity) {
        kaavio.highlighter.highlight(entity.selector, 'preset', entity);
      });

    }

    kaavio.trigger('rendered.renderer');

  }

  return {
    destroyRender: destroyRender,
    render: render
  }
};
