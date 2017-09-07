/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import { normalizeElementId } from "../utils/normalizeElementId";

export const MARKER_PROPERTY_NAMES: ReadonlyArray<MarkerPropertyName> = [
  "markerStart",
  "markerMid",
  "markerEnd",
  "marker"
];
export const NON_FUNC_IRI_MARKER_PROPERTY_VALUES: ReadonlyArray<
  NonFuncIriMarkerPropertyValue
> = ["none", "inherit"];

export function getMarkerId(
  markerLocationType: MarkerPropertyName,
  normalizedName: string,
  color: string,
  backgroundColor: string
): string {
  return normalizeElementId(
    [markerLocationType, normalizedName, color, backgroundColor].join("")
  );
}

export function getMarkerPropertyValue(
  markerLocationType: MarkerPropertyName,
  normalizedName: NonFuncIriMarkerPropertyValue & string,
  color: string,
  backgroundColor: string
): NonFuncIriMarkerPropertyValue | string {
  // Don't make a funciri out of any of the names in NON_FUNC_IRI_MARKER_PROPERTY_VALUES
  if (NON_FUNC_IRI_MARKER_PROPERTY_VALUES.indexOf(normalizedName) > -1) {
    return normalizedName;
  }
  return `url(#${getMarkerId(
    markerLocationType,
    normalizedName,
    color,
    backgroundColor
  )})`;
}

export class Marker extends React.Component<any, any> {
  constructor(props: MarkerComponentProps) {
    super(props);
  }

  render() {
    const {
      id,
      backgroundColor,
      color,
      markerLocationType,
      markerDrawer,
      normalizedName
    } = this.props;

    const { markerAttributes, groupChildren } = markerDrawer(
      backgroundColor,
      color
    );
    const { markerWidth, markerHeight } = markerAttributes;

    const markerId = getMarkerId(
      markerLocationType,
      normalizedName,
      color,
      backgroundColor
    );

    return (
      <marker
        id={markerId}
        key={markerId}
        markerUnits="strokeWidth"
        orient="auto"
        preserveAspectRatio="none"
        refX={markerLocationType === "markerEnd" ? markerWidth : 0}
        refY={markerHeight / 2}
        viewBox={`0 0 ${markerWidth} ${markerHeight}`}
        {...markerAttributes}
      >
        <g
          id={`g-${markerId}`}
          key={`g-${markerId}`}
          transform={
            markerLocationType === "markerEnd"
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
