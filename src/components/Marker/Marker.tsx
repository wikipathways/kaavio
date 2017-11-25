import * as React from "react";
import * as ReactDOM from "react-dom";
import { GetNamespacedMarkerId, MarkerComponentProps } from "../../types";

export class Marker extends React.Component<any, any> {
  getNamespacedMarkerId: GetNamespacedMarkerId;
  constructor(props: MarkerComponentProps) {
    super(props);
    this.getNamespacedMarkerId = props.getNamespacedMarkerId;
  }

  render() {
    const {
      id,
      markerDrawer,
      markerProperty,
      markerName,
      color,
      getNamespacedMarkerId,
      parentBackgroundColor
    } = this.props;

    const { markerAttributes, groupChildren } = markerDrawer(
      parentBackgroundColor,
      color
    );
    const { markerWidth, markerHeight } = markerAttributes;

    const namespacedMarkerId = getNamespacedMarkerId({
      markerProperty,
      markerName,
      color,
      parentBackgroundColor
    });

    return (
      <marker
        id={namespacedMarkerId}
        key={namespacedMarkerId}
        markerUnits="strokeWidth"
        orient="auto"
        preserveAspectRatio="none"
        refX={markerProperty === "markerEnd" ? markerWidth : 0}
        refY={markerHeight / 2}
        viewBox={`0 0 ${markerWidth} ${markerHeight}`}
        {...markerAttributes}
      >
        <g
          id={`g-${namespacedMarkerId}`}
          key={`g-${namespacedMarkerId}`}
          transform={
            markerProperty === "markerEnd"
              ? ""
              : `rotate(180, ${markerWidth / 2}, ${markerHeight / 2})`
          }
        >
          {groupChildren}
        </g>
      </marker>
    );
  }
}
