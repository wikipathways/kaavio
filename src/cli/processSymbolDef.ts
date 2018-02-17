import { DOMParser } from "xmldom";
const select = require("xpath.js");
import { curry, isEmpty } from "lodash/fp";
import { relLuminance } from "../spinoffs/wcag-contrast";

const NS = {
  svg: "http://www.w3.org/2000/svg"
};

const copyAttributeTo = curry(function(sourceEl, targetEl, attributeName) {
  const attributeValue = sourceEl.getAttribute(attributeName);
  if (!isEmpty(attributeValue)) {
    targetEl.setAttribute(attributeName, attributeValue);
  }
});

function surroundWithSymbolEl(contentEl) {
  var dom = new DOMParser().parseFromString(`<svg xmlns="${NS.svg}" />`);
  const symbolEl = dom.createElementNS(NS.svg, "symbol");
  symbolEl.setAttribute("overflow", "visible");

  const copyAttribute = copyAttributeTo(contentEl, symbolEl);
  ["width", "height", "x", "y", "viewBox", "preserveAspectRatio"].forEach(
    copyAttribute
  );

  const id = contentEl.getAttribute("id");
  symbolEl.setAttribute("id", id);
  contentEl.setAttribute("id", id + "-content");

  /*
<symbol id="Brace" overflow="visible" preserveAspectRatio="none" viewBox="0 0 100 100">
	<path stroke="currentColor" d="M1.5 49.5c0-16.167 8.167-24.25 24.5-24.25S50.5 17.167 50.5 1c0 16.167 8.167 24.25 24.5 24.25s24.5 8.083 24.5 24.25" vector-effect="non-scaling-stroke"></path>
</symbol>
//*/

  //<pattern id="PatternQ213580" width="100%" height="100%" patternContentUnits="objectBoundingBox" preserveAspectRatio="xMidYMid" viewBox="0 0 1 1"><image width="1" height="1" href="http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=CC(=O)C(O)=O&amp;abbr=on&amp;hdisp=bridgehead&amp;showtitle=false&amp;zoom=1.0&amp;annotate=none" preserveAspectRatio="xMidYMid"></image></pattern>

  symbolEl.appendChild(contentEl);
  return symbolEl;
}

/*
export function processSymbolDefs1(s) {
  s.observe().map(({ node }) => node.getAttribute("id")).toArray(function(ids) {
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
}
	//*/

export function processSymbolDef({
  node,
  preserveAspectRatio,
  contentTagName,
  destTagName
}): { node; jic: any } {
  if (contentTagName !== destTagName) {
    node = surroundWithSymbolEl(node);
  }

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
        ACCEPTABLE_STROKE_VALUES_REL_LUMINANCES.indexOf(strokeRelLuminance) ===
        -1
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
  return { node, jic: {} };
}
