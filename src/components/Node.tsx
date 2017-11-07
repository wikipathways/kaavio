import * as React from "react";
import {assign, isFinite, pick} from "lodash/fp";
import * as ReactDOM from "react-dom";
import * as validDataUrl from "valid-data-url";

// These are the white-listed SVG tag names that kaavio can render
// TODO either let symbols override these, or else check in CLI to notify user of clobbering.
const SVG_TAG_NAMES = ["circle", "ellipse", "line", "path", "polygon", "polyline", "rect"];
// These are the white-listed SVG attribute names for kaavio, all lowerCamelCased
const SVG_ATTRIBUTES = ["cx", "cy", "d", "height", "id", "fill", "fillOpacity", "fillRule", "pathLength", "points", "r", "rx", "ry", "stroke", "strokeDasharray", "strokeDashoffset", "strokeLinecap", "strokeLinejoin", "strokeMiterlimit", "strokeOpacity", "strokeWidth", "transform", "width", "x", "x1", "x2", "y", "y1", "y2"];
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

	getStateFromProps(props) {
    const {
      backgroundColor,
			borderRadius,
			borderStyle,
      borderWidth,
      color,
      fillOpacity,
      drawAs,
      height,
      id,
			stroke,
      width
    } = props;

		// If drawAs specifies an SVG element, render icon as the SVG element.
		// Otherwise, render as a symbol via a use tag.
		const tagName = SVG_TAG_NAMES.indexOf(drawAs) > -1 ? drawAs : "use";
		const attributes: any = pick(SVG_ATTRIBUTES, props);

		if (!!id) {
			attributes.id = `${id}-icon`;
			attributes.key = `${id}-icon`;
		}

		if (tagName === "use") {
			attributes.href = "#" + drawAs;
		}

		if (attributes.hasOwnProperty("x")) {
			// correcting for translation of container.
			attributes.x = "0";
			attributes.y = "0";
		}

		// TODO do we need to specify these as px?
		if (!!width && isFinite(parseFloat(width))) {
			attributes.width = width + "px";
		}
		if (!!height && isFinite(parseFloat(height))) {
			attributes.height = height + "px";
		}

		// TODO: for icons with borderStyle of double, it appears the actual border
		// width we're currently getting is closer to 4x, but it should be 2x or 3x.
		// TODO: we're getting box-sizing: border-box behavior for a 200x100 rect
		// with a 3px double-line border, but it's slightly off for a 40x40 rect
		// with same border.
		const actualBorderWidth = borderStyle === 'double' ? borderWidth * 4 : borderWidth;
		const scaleX = width / (width + actualBorderWidth);
		const scaleY = height / (height + actualBorderWidth);
		const translateX = width / 2;
		const translateY = height / 2;
		attributes.transform = `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX - scaleX * translateX}, ${translateY - scaleY * translateY})`;

		if (!!backgroundColor) {
			attributes.fill = backgroundColor;
			attributes.fillOpacity = fillOpacity || 1;
		}

		if (!!borderWidth) {
			attributes.stroke = stroke || color;
			attributes.strokeWidth = borderWidth;
		}

		if (borderStyle === "dashed") {
			attributes.strokeDasharray = "5,3";
		}

		if (borderRadius) {
			attributes.rx = borderRadius;
			attributes.ry = borderRadius;
		}

		return {
			tagName: tagName,
			attributes: attributes
		};
	}

  componentWillReceiveProps(nextProps) {
		// TODO this might be slower than it needs to be. Can we set only a subset?
    const nextState = this.getStateFromProps(nextProps);
		this.setState(nextState);
  }

  render() {
		const {props, state} = this;
		const {children} = props;

    return (
      <g ref={containerRef => (this.containerRef = containerRef)}>
				<this.state.tagName
					className="Icon"
					{...state.attributes}
				/>
        {children}
      </g>
    );
  }
}
// TODO href is now preferred. Does it work in enough browsers?
// href={icon ? "#" + icon.id : null}
// xlinkHref={loadedIcon ? "#" + loadedIcon.id : null}
