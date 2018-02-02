import * as React from "react";
import { assign, isFinite, pick } from "lodash/fp";
import * as ReactDOM from "react-dom";
import * as validDataUrl from "valid-data-url";
import { formatClassNames } from "../utils/formatClassNames";
import { NodeProps } from "../types";

// These are the white-listed SVG tag names that kaavio can render
// TODO either let symbols override these, or else check in CLI to notify user of clobbering.
const SVG_TAG_NAMES = [
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect"
];
// These are the white-listed SVG attribute names for kaavio, all lowerCamelCased
const SVG_ATTRIBUTES = [
  "cx",
  "cy",
  "d",
  "height",
  "id",
  "fill",
  "fillOpacity",
  "fillRule",
  "pathLength",
  "points",
  "r",
  "rx",
  "ry",
  "stroke",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "transform",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2"
];
// TODO only x and y are corrected for translation of container. All of these are not: x1, x2, y1, y2, d, points, cx, cy! Fix this.

/**
 * Node is a rectangle within a Kaavio diagram.
 * It can be mapped to other pathway elements. For example, in PVJS this is mapped to metabolites and proteins.
 */
export class Node extends React.Component<any, any> {
  containerRef: any;

  constructor(props: NodeProps) {
    super(props);
    this.state = this.getStateFromProps(props);
  }

  getStateFromProps(
    props
  ): {
    iconTagName: any;
    iconAttributes: Record<string, any>;
    className: string;
    children: any[];
    type: string[];
  } {
    const {
      backgroundColor,
      borderRadius,
      borderStyle,
      borderWidth,
      children,
      className,
      color,
      fillOpacity,
      drawAs,
      height,
      id,
      stroke,
      type,
      width
    } = props;

    const state = { className, children, type };

    // If drawAs specifies an SVG element, render icon as the SVG element.
    // Otherwise, render as a symbol via a use tag.
    const iconTagName = SVG_TAG_NAMES.indexOf(drawAs) > -1 ? drawAs : "use";
    const iconAttributes: any = pick(SVG_ATTRIBUTES, props);

    if (!!id) {
      iconAttributes.id = `${id}-icon`;
      iconAttributes.key = `${id}-icon`;
    }

    if (iconTagName === "use") {
      iconAttributes.href = "#" + drawAs;
      // TODO href is now preferred. Does it work in enough browsers?
      // href={icon ? "#" + icon.id : null}
      // xlinkHref={loadedIcon ? "#" + loadedIcon.id : null}
      if (drawAs === "none") {
        return {
          ...state,
          iconTagName,
          iconAttributes
        };
      }
    }

    if (iconAttributes.hasOwnProperty("x")) {
      // correcting for translation of container.
      iconAttributes.x = "0";
      iconAttributes.y = "0";
    }

    // TODO do we need to specify these as px?
    if (!!width && isFinite(parseFloat(width))) {
      iconAttributes.width = width + "px";
    }
    if (!!height && isFinite(parseFloat(height))) {
      iconAttributes.height = height + "px";
    }

    // TODO: for icons with borderStyle of double, it appears the actual border
    // width we're currently getting is closer to 4x, but it should be 2x or 3x.
    // TODO: we're getting box-sizing: border-box behavior for a 200x100 rect
    // with a 3px double-line border, but it's slightly off for a 40x40 rect
    // with same border.
    const actualBorderWidth = borderStyle === "double"
      ? borderWidth * 4
      : borderWidth;
    const scaleX = width / (width + actualBorderWidth);
    const scaleY = height / (height + actualBorderWidth);
    const translateX = width / 2;
    const translateY = height / 2;
    iconAttributes.transform = `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX -
      scaleX * translateX}, ${translateY - scaleY * translateY})`;

    if (!!backgroundColor) {
      iconAttributes.fill = backgroundColor;
      iconAttributes.fillOpacity = isFinite(fillOpacity) ? fillOpacity : 1;
    }

    if (!!borderWidth) {
      iconAttributes.stroke = stroke || color;
      iconAttributes.strokeWidth = borderWidth;
    }

    if (borderStyle === "dashed") {
      iconAttributes.strokeDasharray = "5,3";
    }

    if (borderRadius) {
      iconAttributes.rx = borderRadius;
      iconAttributes.ry = borderRadius;
    }

    return {
      ...state,
      iconTagName,
      iconAttributes
    };
  }

  componentWillReceiveProps(nextProps) {
    // TODO this might be slower than it needs to be. Can we set only a subset?
    const nextState = this.getStateFromProps(nextProps);
    this.setState(nextState);
  }

  render() {
    const { state } = this;
    const { children, className, iconAttributes, type } = state;

    return (
      <g
        className={formatClassNames(type, className, "Node")}
        ref={containerRef => (this.containerRef = containerRef)}
      >
        <state.iconTagName
          className={formatClassNames(type, className, "Node", "Icon")}
          {...iconAttributes}
        />
        {children}
      </g>
    );
  }
}
