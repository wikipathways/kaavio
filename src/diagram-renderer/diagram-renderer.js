var _ = require('lodash');
var fs = require('fs');
var highland = require('highland');
var insertCss = require('insert-css');
var RendererImg = require('./renderer-img');
var RendererSvg = require('./renderer-svg');
var Selector = require('./selector.js');
var InfoBox = require('./info-box.js');
var PublicationXref = require('./publication-xref.js');
var EntityReference = require('../annotation-panel/entity-reference.js');
var simpleModal = global.simpleModal = require('simple-modal');
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
   * @param  {Object} kaavio Instance Object
   * @return {boolean} success state
   */
  function destroyRender(kaavio, sourceData) {
    // TODO
    return true
  }

  /**
   * Renders a given sourceData object
   * @param  {Object} kaavio       kaavio Instance Object
   */
  function render(kaavio) {
    var sourceData = kaavio.sourceData;
    var renderer = RendererSvg.init(kaavio)
    sourceData.selector =
        Selector.init(kaavio.sourceData.pvjson.elements, renderer)

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

    // TODO refactor this to make sure it works multi-instance
    var kaavioContainerElement =
        document.querySelector('.kaavio-container');
    var diagramContainerElement = kaavioContainerElement.querySelector(
        '.diagram-container');

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

    kaavio.trigger('rendered.renderer')
  }

  return {
    destroyRender: destroyRender,
    render: render
  }
};
