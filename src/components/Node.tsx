import * as React from "react";
import * as ReactDOM from "react-dom";
import * as validDataUrl from "valid-data-url";

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
      strokeDasharray,
      drawAs,
      height,
      id,
      width
    } = props;

		const actualBorderWidth = borderStyle === 'double' ? borderWidth * 3 : borderWidth;
		const scaleX = (width - actualBorderWidth) / width;
		const scaleY = (height - actualBorderWidth) / height;
		const translateX = width / 2;
		const translateY = height / 2;

		const attributes: any = {
			id: `${id}-icon`,
			key: `${id}-icon`,
			x: "0",
			y: "0",
			width: width + "px",
			height: height + "px",
			transform: `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX - scaleX * translateX}, ${translateY - scaleY * translateY})`,
			color: color,
			fill: backgroundColor,
			fillOpacity: fillOpacity || 1,
			stroke: color,
			strokeWidth: borderWidth,
			strokeDasharray: strokeDasharray,
			className: "Icon"
		};

		if (borderRadius) {
			attributes.rx = borderRadius;
			attributes.ry = borderRadius;
		}

		let tagName;
		if (['rect'].indexOf(drawAs) === -1) {
			tagName = 'use';
			attributes.href="#" + drawAs;
		} else {
			tagName = drawAs;
		}

		return {
			tagName: tagName,
			attributes: attributes
		};
	}

  componentWillReceiveProps(nextProps) {
		// TODO this might be slower than it needs to be
    const nextState = this.getStateFromProps(nextProps);
		this.setState(nextState);
  }

  render() {
		const {props, state} = this;
		const {children} = props;

    return (
      <g ref={containerRef => (this.containerRef = containerRef)}>
				<this.state.tagName
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
