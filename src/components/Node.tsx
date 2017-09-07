import * as React from "react";
import * as ReactDOM from "react-dom";
import { Observable, AjaxRequest, Subject } from "rxjs";
import * as _ from "lodash";
import * as validDataUrl from "valid-data-url";
import { Base64 } from "js-base64";
import { NodeProps } from "../typings";
import { normalizeElementId } from "../utils/normalizeElementId";

/**
 * Node is a rectangle within a Kaavio diagram.
 * It can be mapped to other pathway elements. For example, in PVJS this is mapped to metabolites and proteins.
 */
export class Node extends React.Component<any, any> {
  containerRef: any;

  constructor(props: NodeProps) {
    super(props);
    this.state = {
      iconSuffix: new Date().toISOString().replace(/\W/g, "")
    };
  }

  render() {
    const {
      borderWidth,
      color,
      drawAs,
      filter,
      height,
      id,
      icon,
      width,
      children,
      backgroundColor
    } = this.props;
    const { loadedIcon } = this.state;

    // Add the style too. Fixes firefox bug where fill, stroke etc. isn't inherited
    const style = {
      fill: backgroundColor,
      color: color,
      stroke: color,
      strokeWidth: borderWidth
    };
    return (
      <g ref={containerRef => (this.containerRef = containerRef)}>
        <use
          id={`icon-for-${id}`}
          key={`icon-for-${id}`}
          x="0"
          y="0"
          width={width + "px"}
          height={height + "px"}
          style={style}
          fill={backgroundColor}
          href={"#" + icon}
          filter={!!filter ? `url(#${filter})` : null}
          stroke={color}
          strokeWidth={borderWidth}
          className="Icon"
        />
        {children}
      </g>
    );
  }
}
// href={icon ? "#" + icon.id : null}
// xlinkHref={loadedIcon ? "#" + loadedIcon.id : null}
