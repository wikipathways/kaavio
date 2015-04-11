var _ = require('lodash');
var fs = require('fs');
var highland = require('highland');
var insertCss = require('insert-css');
var RendererSvg = require('./renderer-svg');
var Selector = require('./selector');
var InfoBox = require('./info-box');
var PublicationXref = require('./publication-xref');
var EntityReference = require('../annotation-panel/entity-reference');
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
   * @param  {Object} privateInstance kaavio private Instance Object
   * @return {boolean} success state
   */
  function destroyRender(privateInstance, sourceData) {
    // TODO
    return true
  }

  /**
   * Renders a given sourceData object
   * @param  {Object} privateInstance kaavio private Instance Object
   */
  function render(privateInstance) {
    var sourceData = privateInstance.sourceData;
    var renderer = RendererSvg.init(privateInstance)
    sourceData.selector =
        Selector.init(privateInstance.sourceData.pvjson.elements, renderer)

    var containerElement = privateInstance.containerElement;

    // TODO refactor this to make sure it works multi-instance
    privateInstance.diagramContainerElement = privateInstance.diagramContainerElement ||
        containerElement.querySelector('.diagram-container');
    var diagramContainerElement = privateInstance.diagramContainerElement;

    var viewport = privateInstance.$element.select('g.viewport')

    // InfoBox
    InfoBox.render(viewport, privateInstance.sourceData.pvjson);

    // Publication Xref
    var elementsWithPublicationXrefs = privateInstance.sourceData.pvjson.elements
    .filter(function(element) {return !!element.xrefs;});

    if (elementsWithPublicationXrefs.length > 0) {
      elementsWithPublicationXrefs.forEach(
          function(elementWithPublicationXrefs) {
        PublicationXref.render(privateInstance, viewport, elementWithPublicationXrefs);
      });
    }

    // Svg-pan-zoom
    // Should come last as it is fitting and centering viewport
    var svgSelection = d3.select('#' + 'kaavio-diagram-' + privateInstance.instanceId);
    var svgElement = svgSelection[0][0];
    var svgPanZoom = SvgPanZoom(svgElement, {
      controlIconsEnabled: true,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 20.0,
      zoomEnabled: false,
      onZoom: function(scale) {
        privateInstance.trigger('zoomed.renderer', scale)
      },
      onPan: function(x, y) {
        privateInstance.trigger('panned.renderer', {x: x, y: y})
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
    privateInstance.panZoom = svgPanZoom;

    // Make SVG resizable
    privateInstance.panZoom.resizeDiagram = function() {
      svgElement.setAttribute('width', diagramContainerElement.clientWidth)
      svgElement.setAttribute('height',
          diagramContainerElement.clientHeight)

      svgPanZoom.updateBBox();
      svgPanZoom.resize();
      svgPanZoom.fit();
      svgPanZoom.center();
    };

    //privateInstance.panZoom.resizeDiagram();

    privateInstance.trigger('rendered.renderer');
  }

  return {
    destroyRender: destroyRender,
    render: render
  }
};
