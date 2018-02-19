import * as React from "react";
import * as ReactDom from "react-dom";
import { map } from "lodash/fp";
import { Kaavio } from "./Kaavio";

/**
 * Checks if an object is a DOM element
 *
 * @param  {object}  o HTML element or String
 * @return {Boolean}   returns true if object is a DOM element
 */
function isElement(o) {
  return typeof HTMLElement === "object"
    ? o instanceof HTMLElement ||
        o instanceof SVGElement ||
        o instanceof SVGSVGElement //DOM2
    : o &&
        typeof o === "object" &&
        o !== null &&
        o.nodeType === 1 &&
        typeof o.nodeName === "string";
}

/**
 * Initialize the global constructor for JqueryKaavioPlugin
 *
 * @param {object} window
 * @param {object} [$] optional jQuery or Zepto instance
 * @return
 */
module.exports = function(window, $) {
  ("use strict");

  /**
   *
   */
  if (typeof $ !== undefined) {
    /**
     * jQuery plugin entry point. Only if jQuery is defined.
     * If option is 'get' then returns an array of jqueryKaavioPlugin public instances.
     * Otherwise returns an jQuery object to allow chaining.
     *
     * @param  {string} option
     * @return {object} array || jQuery object
     */
    $.fn.kaavio = function(option) {
      // Instantiate Kaavio for all elements
      var $return = this.each(function() {
        var $this = $(this);
        var data = $this.data("kaavio");
        var options = typeof option == "object" && option;

        if (!data) {
          $this.data("kaavio", function() {
            return ReactDom.render(
              <Kaavio
                pathway={data.pathway}
                entitiesById={data.entitiesById}
              />,
              this
            );
          });
        }
      });

      if (option === "get") {
        // Return an array of Kaavio instances
        return $.map(this, function(a) {
          return $(a).data("kaavio").getPublicInstance();
        });
      } else {
        // Return jQuery object
        return $return;
      }
    };
  }

  /**
   * Globally available method
   * Returns an array of public instances
   *
   * @param  {string} selector
   * @param  {object} option
   * @return {array}
   */
  window.jqueryKaavioPlugin = function(selector, option) {
    var $elements;

    if (isElement(selector)) {
      $elements = [[selector]];
    } else {
      $elements = document.querySelector(selector);
    }

    return map(function(element) {
      if (element.data === undefined) {
        element.data = {};
      }

      var data;
      var options = typeof option == "object" ? option : {};

      if (element.data.kaavio === undefined) {
        element.data.kaavio = data = ReactDom.render(
          <Kaavio pathway={data.pathway} entitiesById={data.entitiesById} />,
          element
        );
      } else {
        data = element.data.kaavio;
      }

      return data.getPublicInstance();
    }, $elements[0]);
  };
};
