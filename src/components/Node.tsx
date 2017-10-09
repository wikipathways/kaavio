import * as React from "react";
import * as ReactDOM from "react-dom";
import { Observable, AjaxRequest, Subject } from "rxjs";
import * as _ from "lodash";
import * as validDataUrl from "valid-data-url";
import { NodeProps } from "../typings";

/**
 * Node is a rectangle within a Kaavio diagram.
 * It can be mapped to other pathway elements. For example, in PVJS this is mapped to metabolites and proteins.
 */
export class Node extends React.Component<any, any> {
  containerRef: any;

  constructor(props: NodeProps) {
    super(props);
  }

  render() {
    const {
      borderWidth,
      color,
      fillOpacity,
      strokeDasharray,
      drawAs,
      height,
      id,
      width,
      children,
      backgroundColor
    } = this.props;

    // NOTE: the stroke width is applied to the icon, but if
    // the icon does not have the same dimensions as the entity,
    // the stroke width is scaled by the ratio between them, e.g.,
    // if the Rectangle icon is 100 x 100 and
    // the entity is 200 x 100 with a stroke width of 5, then
    // the stroke width of the displayed entity would be
    //   left and right sides: 5 * (200 / 100) = 10
    //   top and bottom sides: 5 * (100 / 100) = 5
    // Until we can figure out a better way of handling this, we're
    // just assuming the icons all have dimensions of 100 and scaling
    // the stroke width to 100 / the mean of the entity width and height.
    // TODO figure out a better solution.
    //const strokeWidth = borderWidth * (100 / ((width + height) / 2));

    /*
    // Add the style too. Fixes firefox bug where fill, stroke etc. isn't inherited
    const style = {
      fill: backgroundColor,
      color: color,
      stroke: color,
      strokeWidth: borderWidth,
      strokeDasharray: strokeDasharray,
      fillOpacity: fillOpacity || 1
    };
		style={style}
		//*/
    return (
      <g ref={containerRef => (this.containerRef = containerRef)}>
        <use
          id={`icon-for-${id}`}
          key={`icon-for-${id}`}
          x="0"
          y="0"
          width={width + "px"}
          height={height + "px"}
          color={color}
          fill={backgroundColor}
          fillOpacity={fillOpacity || 1}
          href={"#" + drawAs}
          stroke={color}
          strokeWidth={borderWidth}
          strokeDasharray={strokeDasharray}
          className="Icon"
        />
        {children}
      </g>
    );
  }
}
// TODO href is now preferred. Does it work in enough browsers?
// href={icon ? "#" + icon.id : null}
// xlinkHref={loadedIcon ? "#" + loadedIcon.id : null}
