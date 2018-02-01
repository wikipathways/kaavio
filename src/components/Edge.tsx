import { intersection, keys } from "lodash/fp";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getSVGMarkerReferenceType, MARKER_PROPERTIES } from "./Marker/helpers";
import { formatClassNames } from "../utils/formatClassNames";
import { formatSVGReference } from "../spinoffs/formatSVGReference";
import {
  GetNamespacedMarkerId,
  MarkerProperty,
  StringReferenceValue
} from "../types";

export class Edge extends React.Component<any, any> {
  getNamespacedMarkerId: GetNamespacedMarkerId;
  constructor(props) {
    super(props);
    this.getNamespacedMarkerId = props.getNamespacedMarkerId;
  }

  getMarkerPropertyValue = (
    markerProperty: MarkerProperty,
    markerName: StringReferenceValue & string,
    color: string,
    parentBackgroundColor: string
  ): StringReferenceValue | string => {
    const { getNamespacedMarkerId } = this;
    const svgReferenceType = getSVGMarkerReferenceType(markerName);

    if (svgReferenceType === "string") {
      // Don't make a FuncIRI out of a string value
      return markerName;
    } else if (svgReferenceType === "nonLocalIRI") {
      // We can't set the color, etc. for a non-local IRI
      return formatSVGReference(markerName, [svgReferenceType]);
    }

    const namespacedMarkerId = getNamespacedMarkerId({
      markerProperty,
      markerName,
      color,
      parentBackgroundColor
    });
    return formatSVGReference(namespacedMarkerId, [svgReferenceType]);
  };

  // making sure we've defined any markers referenced after initial mount
  componentWillReceiveProps(nextProps) {
    const { getNamespacedMarkerId } = this;
    const { color, parentBackgroundColor } = nextProps;
    intersection(MARKER_PROPERTIES, keys(nextProps)).forEach(function(
      markerProperty: MarkerProperty
    ) {
      const markerName = nextProps[markerProperty];
      if (markerName) {
        if (!!getNamespacedMarkerId) {
          getNamespacedMarkerId({
            markerProperty,
            markerName,
            color,
            parentBackgroundColor
          });
        }
      }
    });
  }

  render() {
    const { getMarkerPropertyValue, getNamespacedMarkerId } = this;
    const {
      id,
      drawAs,
      edgeDrawerMap,
      color,
      parentBackgroundColor,
      strokeDasharray,
      borderWidth,
      points,
      type
    } = this.props;

    const { d } = new edgeDrawerMap[drawAs](points);

    const markerProperties = intersection(
      MARKER_PROPERTIES,
      keys(this.props)
    ).reduce((acc, markerProperty: MarkerProperty) => {
      const markerName = this.props[markerProperty];
      if (markerName) {
        acc[markerProperty] = getMarkerPropertyValue(
          markerProperty,
          markerName,
          color,
          parentBackgroundColor
        );
      }
      return acc;
    }, {});

    return (
      <path
        id={id}
        key={`${id}-path`}
        className={formatClassNames(type)}
        d={d}
        fill={"transparent"}
        fillOpacity="0"
        stroke={color}
        strokeDasharray={strokeDasharray}
        strokeWidth={borderWidth}
        {...markerProperties}
      />
    );
  }
}
