const select = require("xpath.js");
import { DOMParser } from "xmldom";

import { relLuminance } from "../spinoffs/wcag-contrast";
import { MarkerProperty } from "../types";
import {
  createMarkerId,
  MARKER_PROPERTIES
} from "../components/Marker/helpers";

const NS = {
  svg: "http://www.w3.org/2000/svg"
};

const markerPropertyToRefXMultiplierMap: Record<MarkerProperty, number> = {
  marker: 0.5,
  markerStart: 0,
  markerMid: 0.5,
  markerEnd: 1
};

function surroundWithFlip180Container(markerEl, markerWidth, markerHeight) {
  var dom = new DOMParser().parseFromString(`<svg xmlns="${NS.svg}" />`);
  const container = dom.createElementNS(NS.svg, "g");
  container.setAttribute(
    "transform",
    `rotate(180, ${markerWidth / 2}, ${markerHeight / 2})`
  );

  /* Strange that the following doesn't work
  const childNodeClones = markerEl.cloneNode(true).childNodes || [];
  const childNodes = markerEl.childNodes || [];
  for (let i = 0; i < childNodeClones.length; i++) {
    container.appendChild(childNodeClones[i].cloneNode(true));
    markerEl.removeChild(childNodes[i]);
  }
  //*/

  //* It doesn't seem the following should be any different than what's above, but it is:
  const childNodeClones = markerEl.cloneNode(true).childNodes || [];
  for (let i = 0; i < childNodeClones.length; i++) {
    container.appendChild(childNodeClones[i].cloneNode(true));
  }
  do {
    markerEl.removeChild(markerEl.firstChild);
  } while (markerEl.hasChildNodes());
  //*/

  markerEl.appendChild(container);
  return markerEl;
}

export function processMarkerDef({
  node,
  preserveAspectRatio
}: {
  node;
  preserveAspectRatio?: boolean;
}): { node; jic: any }[] {
  const id = node.getAttribute("id");

  const markerWidth = parseFloat(node.getAttribute("markerWidth"));
  if (!isFinite(markerWidth)) {
    throw new Error(
      `markerWidth "${markerWidth}" for ${id} is not a finite number.`
    );
  }

  const markerHeight = parseFloat(node.getAttribute("markerHeight"));
  if (!isFinite(markerHeight)) {
    throw new Error(
      `markerHeight "${markerHeight}" for ${id} is not a finite number.`
    );
  }

  const ACCEPTABLE_NON_COLOR_FILL_VALUES = ["none", "transparent"];
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
        console.warn(`\tWarning: if fill attribute specified for markers, these are the accepted values:
	"none", "transparent", "black" or "white"
	Converting:
	${fill}
	to:
	${updatedFill}`);
        fillAttr.value = updatedFill;
      }
    }
  }

  if (!node.hasAttribute("stroke-dasharray")) {
    // TODO watch for Safari to fix its behavior related to this.
    // Chrome and FF don't apply the stroke-dasharray of the
    // edge to the marker, but Safari does.
    node.setAttribute("stroke-dasharray", 99999);
  }

  if (!node.hasAttribute("refY")) {
    node.setAttribute("refY", markerHeight / 2);
  }
  if (!node.hasAttribute("viewBox")) {
    node.setAttribute("viewBox", `0 0 ${markerWidth} ${markerHeight}`);
  }
  return MARKER_PROPERTIES.map(function(markerProperty) {
    const nodeClone = node.cloneNode(true);
    const markerForThisProperty = markerProperty === "markerStart"
      ? surroundWithFlip180Container(nodeClone, markerWidth, markerHeight)
      : nodeClone;

    const updatedId = createMarkerId(markerProperty, id);
    nodeClone.setAttribute("id", updatedId);

    if (!node.hasAttribute("refX")) {
      nodeClone.setAttribute(
        "refX",
        markerPropertyToRefXMultiplierMap[markerProperty] * markerWidth
      );
    }
    const contextStrokeDashoffset = parseFloat(
      nodeClone.getAttribute("data-context-stroke-dashoffset")
    );
    return {
      node: nodeClone,
      jic: {
        [updatedId]: {
          contextStrokeDashoffset: isFinite(contextStrokeDashoffset)
            ? contextStrokeDashoffset
            : markerHeight
        }
      }
    };
  });
}
