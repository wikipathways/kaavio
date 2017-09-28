import * as React from "react";
import * as ReactDOM from "react-dom";

export const MARKER_PROPERTIES: ReadonlyArray<MarkerProperty> = [
  "markerStart",
  "markerMid",
  "markerEnd",
  "marker"
];
export const NON_FUNCIRI_MARKER_PROPERTY_VALUES: ReadonlyArray<
  NonFunciriMarkerPropertyValue
> = ["none", "inherit"];

export function getMarkerId(
  markerProperty: MarkerProperty,
  markerName: NonFunciriMarkerPropertyValue & string,
  color: string,
  parentBackgroundColor: string
): string {
  return [markerProperty, markerName, color, parentBackgroundColor].join("");
}

export function getMarkerPropertyValue(
  markerProperty: MarkerProperty,
  markerName: NonFunciriMarkerPropertyValue & string,
  color: string,
  parentBackgroundColor: string
): NonFunciriMarkerPropertyValue | string {
  // Don't make a funciri out of any of the names in NON_FUNCIRI_MARKER_PROPERTY_VALUES
  if (NON_FUNCIRI_MARKER_PROPERTY_VALUES.indexOf(markerName) > -1) {
    return markerName;
  }
  return `url(#${getMarkerId(
    markerProperty,
    markerName,
    color,
    parentBackgroundColor
  )})`;
}

export class Marker extends React.Component<any, any> {
  constructor(props: MarkerComponentProps) {
    super(props);
  }

  render() {
    const {
      id,
      markerDrawer,
      markerProperty,
      color,
      parentBackgroundColor
    } = this.props;

    const { markerAttributes, groupChildren } = markerDrawer(
      parentBackgroundColor,
      color
    );
    const { markerWidth, markerHeight } = markerAttributes;

    return (
      <marker
        id={id}
        markerUnits="strokeWidth"
        orient="auto"
        preserveAspectRatio="none"
        refX={markerProperty === "markerEnd" ? markerWidth : 0}
        refY={markerHeight / 2}
        viewBox={`0 0 ${markerWidth} ${markerHeight}`}
        {...markerAttributes}
      >
        <g
          id={`g-${id}`}
          key={`g-${id}`}
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
