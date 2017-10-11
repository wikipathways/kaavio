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

    return (
      <g ref={containerRef => (this.containerRef = containerRef)}>
        <use
          id={`${id}-icon`}
          key={`${id}-icon`}
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
