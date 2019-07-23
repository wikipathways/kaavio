import * as React from "react";
import { assign, difference, isEmpty, isFinite, pick } from "lodash/fp";
import * as ReactDOM from "react-dom";
import * as validDataUrl from "valid-data-url";
import { NodeProps } from "../types";
import { Filter } from "./Filter/Filter";

// TODO use TS types updated for version 16. But I also have some changes
// I made for SVG attributes that need to get merged.
const Fragment = React["Fragment"];

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
  "style",
  "transform",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2"
];

const SVG_STYLE_ATTRIBUTES = [
  "fill",
  "fillOpacity",
  "stroke",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth"
];

const ICON_ONLY_ATTRIBUTES = difference(SVG_ATTRIBUTES, SVG_STYLE_ATTRIBUTES);
// TODO only x and y are corrected for translation of container. All of these are not: x1, x2, y1, y2, d, points, cx, cy! Fix this.

/**
 * Node is a rectangle within a Kaavio diagram.
 * It can be mapped to other pathway elements. For example, in PVJS this is mapped to metabolites and proteins.
 */
export class Node extends React.Component<any, any> {
  containerRef: any;

  constructor(props: NodeProps) {
    super(props);
  }

  componentWillReceiveProps(nextProps) {
    // TODO this might be slower than it needs to be. Can we set only a subset?
    //const nextState = this.getStateFromProps(nextProps);
    //this.setState(nextState);
  }

  renderIcon() {
    const { props } = this;
    const {
      fill,
      rx,
      ry,
      strokeStyle,
      strokeWidth,
      children,
      stroke,
      fillOpacity,
      drawAs,
      filters,
      height,
      id,
      parentFill,
      style,
      type,
      width
    } = props;
    // If drawAs specifies an SVG element, render icon as the SVG element.
    // Otherwise, render as a symbol via a use tag.
    const TagName = SVG_TAG_NAMES.indexOf(drawAs) > -1 ? drawAs : "use";
    const iconOnlyProps: any = pick(ICON_ONLY_ATTRIBUTES, props);
    const firstChildStyleProps: any = pick(SVG_STYLE_ATTRIBUTES, props);

    if (!!id) {
      iconOnlyProps.id = `${id}-icon`;
      iconOnlyProps.key = `${id}-icon`;
    }

    if (TagName === "use") {
      // TODO href is now preferred, but it doesn't work in Safari. Why?
      //iconOnlyProps.href = "#" + drawAs;
      iconOnlyProps.xlinkHref = "#" + drawAs;
    }

    if (iconOnlyProps.hasOwnProperty("x")) {
      // correcting for translation of container.
      iconOnlyProps.x = "0";
      iconOnlyProps.y = "0";
    }

    // TODO do we need to specify these as px?
    if (!!width && isFinite(parseFloat(width))) {
      iconOnlyProps.width = width + "px";
    }
    if (!!height && isFinite(parseFloat(height))) {
      iconOnlyProps.height = height + "px";
    }

    // TODO: for icons with strokeStyle of double, it appears the actual stroke
    // width we're currently getting is closer to 4x, but it should be 2x or 3x.
    // TODO: we're getting box-sizing: border-box behavior for a 200x100 rect
    // with a 3px double-line stroke, but it's slightly off for a 40x40 rect
    // with same stroke.
    const actualStrokeWidth =
      strokeStyle === "double" ? strokeWidth * 4 : strokeWidth;
    if (width + actualStrokeWidth > 0 && height + actualStrokeWidth > 0) {
      const scaleX = width / (width + actualStrokeWidth);
      const scaleY = height / (height + actualStrokeWidth);
      const translateX = width / 2;
      const translateY = height / 2;
      iconOnlyProps.transform = `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX -
        scaleX * translateX}, ${translateY - scaleY * translateY})`;
    }

    if (!!fill) {
      firstChildStyleProps.fillOpacity = isFinite(fillOpacity)
        ? fillOpacity
        : 1;
    }

    if (!!strokeWidth) {
      firstChildStyleProps.strokeWidth = strokeWidth;
    }

    if (strokeStyle === "dashed") {
      firstChildStyleProps.strokeDasharray = "5,3";
    }

    if (rx) {
      iconOnlyProps.rx = rx;
    }
    if (ry) {
      iconOnlyProps.ry = ry;
    }

    return (
      <Filter
        filters={filters}
        strokeStyle={strokeStyle}
        childTag={TagName}
        parentFill={parentFill}
        childOnlyProps={{
          ...iconOnlyProps,
          ...{ className: "Icon" }
        }}
        firstChildStyleProps={firstChildStyleProps}
      />
    );
  }

  render() {
    const { children } = this.props;

    return (
      <Fragment>
        {this.renderIcon()}
        {children}
      </Fragment>
    );
  }
}
