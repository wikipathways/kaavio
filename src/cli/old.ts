const select = require("xpath.js");

import { relLuminance } from "../spinoffs/wcag-contrast";

const NS = {
  svg: "http://www.w3.org/2000/svg"
};

export function processSymbolDefs(s) {
  s.observe()
    .map(({ node }) => node.getAttribute("id"))
    .toArray(function(ids) {
      if (ids.length > 0) {
        const suggestedFillOnlyCSS = ids
          .map((id, i) => `#${id} {fill: currentColor; stroke: none;}`)
          .join("\n\t");

        console.log(`
Note that most SVG glyph sets expect a fill color but not a stroke.
To disable stroke for your def(s) and enable fill, add this to the CSS string for Kaavio prop style.diagram:

<style xmlns="${NS.svg}" type="text/css">
	<![CDATA[
	${suggestedFillOnlyCSS}
	]]>
</style>
`);
      }
    });

  return s.map(function({ node, preserveAspectRatio }) {
    const id = node.getAttribute("id");

    if (preserveAspectRatio) {
      node.setAttribute("preserveAspectRatio", "xMidYMid");
    } else {
      node.setAttribute("preserveAspectRatio", "none");
    }

    const ACCEPTABLE_NON_COLOR_STROKE_VALUES = [
      "currentColor",
      "none",
      "transparent"
    ];
    const ACCEPTABLE_STROKE_VALUES_REL_LUMINANCES = [0, 1];
    const strokeAttrs = select(node, "//*/@stroke");
    for (let i = 0; i < strokeAttrs.length; i++) {
      const strokeAttr = strokeAttrs[i];
      const stroke = strokeAttr.value;
      if (ACCEPTABLE_NON_COLOR_STROKE_VALUES.indexOf(stroke) === -1) {
        const strokeRelLuminance = relLuminance(stroke);
        if (
          ACCEPTABLE_STROKE_VALUES_REL_LUMINANCES.indexOf(
            strokeRelLuminance
          ) === -1
        ) {
          const updatedStroke = strokeRelLuminance > 0.5 ? "white" : "black";
          console.warn(`\tWarning: if stroke attribute specified for symbols, these are the accepted values:
	"currentColor", "none", "transparent", "black" or "white"
	Converting:
	${stroke}
	to:
	${updatedStroke}`);
          strokeAttr.value = updatedStroke;
        }
      }
    }

    const ACCEPTABLE_NON_COLOR_FILL_VALUES = [
      "currentColor",
      "none",
      "transparent"
    ];
    const ACCEPTABLE_FILL_VALUES_REL_LUMINANCES = [0, 1];
    const fillAttrs = select(node, "//*/@fill");
    for (let i = 0; i < fillAttrs.length; i++) {
      const fillAttr = fillAttrs[i];
      const fill = fillAttr.value;
      if (ACCEPTABLE_NON_COLOR_FILL_VALUES.indexOf(fill) === -1) {
        const fillRelLuminance = relLuminance(fill);
        if (
          ACCEPTABLE_FILL_VALUES_REL_LUMINANCES.indexOf(fillRelLuminance) === -1
        ) {
          const updatedFill = fillRelLuminance > 0.5 ? "white" : "black";
          console.warn(`\tWarning: if fill attribute specified for symbols, these are the accepted values:
	"currentColor", "none", "transparent", "black" or "white"
	Converting:
	${fill}
	to:
	${updatedFill}`);
          fillAttr.value = updatedFill;
        }
      }
    }

    const viewBox = node.getAttribute("viewBox");
    if (!viewBox) {
      const width = node.getAttribute("width") || 200;
      const height = node.getAttribute("height") || 100;
      if (!width || !height) {
        throw new Error(`Cannot set viewBox for ${id}.`);
      }
      node.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = node
      .getAttribute("viewBox")
      .split(/[\ ,]/);
    const x = node.getAttribute("x");
    const y = node.getAttribute("y");
    if (!isFinite(x) || !isFinite(y) || x > viewBoxWidth || y > viewBoxHeight) {
      node.setAttribute("x", viewBoxX);
      node.setAttribute("y", viewBoxY);
    }
    return { defType: "symbols", node, cache: {} };
  });
}
