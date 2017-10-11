import { intersection, keys } from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  getSVGMarkeReferenceType,
  MARKER_PROPERTIES
} from "./Marker/MarkerDefs";
import * as edgeDrawers from "../drawers/edges/__bundled_dont_edit__";
import { formatSVGReference } from "../spinoffs/formatSVGReference";

export class Edge extends React.Component<any, any> {
  getNamespacedMarkerId: (
    latestMarkerReferenced: LatestMarkerReferenced
  ) => string;
  constructor(props) {
    super(props);
    this.getNamespacedMarkerId = props.getNamespacedMarkerId;
  }

  getMarkerPropertyValue = (
    markerProperty: MarkerProperty,
    markerName: NonFunciriMarkerPropertyValue & string,
    color: string,
    parentBackgroundColor: string
  ): NonFunciriMarkerPropertyValue | string => {
    const { getNamespacedMarkerId } = this;
    const svgReferenceType = getSVGMarkeReferenceType(markerName);

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
      color,
      parentBackgroundColor,
      strokeDasharray,
      borderWidth,
      points,
      type
    } = this.props;

    const { d } = new edgeDrawers[drawAs](points);

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
        className={type}
        d={d}
        fill={"transparent"}
        stroke={color}
        strokeDasharray={strokeDasharray}
        strokeWidth={borderWidth}
        {...markerProperties}
      />
    );
  }
}
