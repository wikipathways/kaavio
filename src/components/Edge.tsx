import { floor, intersection, keys, omit, sum, toFinite } from "lodash/fp";
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
    markerName: StringReferenceValue & string
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
      markerName
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
            markerName
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
      markerDrawerMap,
      color,
      parentBackgroundColor,
      strokeDasharray: strokeDasharrayMidString,
      borderWidth,
      points,
      type
    } = this.props;

    const { d, getTotalLength } = new edgeDrawerMap[drawAs](points);

    const markerProperties = intersection(
      MARKER_PROPERTIES,
      keys(this.props)
    ).reduce((acc, markerProperty: MarkerProperty) => {
      const markerName = this.props[markerProperty];
      if (markerName) {
        acc[markerProperty] = getMarkerPropertyValue(
          markerProperty,
          markerName
        );
      }
      return acc;
    }, {});

    const markerDetailsMap = intersection(
      MARKER_PROPERTIES,
      keys(this.props)
    ).reduce((acc, markerProperty: MarkerProperty) => {
      const markerName = this.props[markerProperty];
      if (markerName && markerDrawerMap[markerName]) {
        acc[markerProperty] = markerDrawerMap[markerName]("white", "black");
      }
      return acc;
    }, {});

    /* NOTE: some markers require that the path visibly starts later (or terminates
     * earlier) than where specified by the start point (or end point),
     * e.g., the Pvjs Inhibition marker.
     * We used to handle this by adding a background-colored rectangle to the
     * marker to cover that part of the path, but now we're using stroke-dasharray,
     * because this method means we get the actual background color using just one
     * marker instead of trying to calculate all possible background colors and
     * using a different marker for each one.
     * The stroke-dasharray property takes a space and/or comma separated list of
     * numbers.
     *
     * The first number, N0, says to make a dash (visible part of the path)
     * from the start point to a point N0 units (px?) along the path.
     *
     * The next number, N1, says to make a gap (invisible part of the path) from
     * the previous point to a point N1 units along the path.
     *
     * start        N0                N1                 end
     * |            |                 |                  |
     * v            v                 v                  v
     * --------------                 -------------- ... 
     *
     * The same logic applies for each subsequent number. If after using all the 
     * numbers we haven't reach the end point, we just start over from N0 and repeat
     * the until we reach the end point.
     *
     * There's also something about if an odd number of numbers is provided, the
     * stroke-dasharray is repeated once to get an even number of numbers.
     *
     * It would be nice to use the stroke-dashoffset property for this, but it
     * appears that only applies to the start, so it wouldn't work for markers
     * at the end.
     */
    const strokeDasharray = [];
    const markerStartGap = !!markerDetailsMap.markerStart &&
      !!markerDetailsMap.markerStart.markerAttributes
      ? markerDetailsMap.markerStart.markerAttributes["data-gap"]
      : 0;
    if (markerStartGap) {
      strokeDasharray.push(0);
      strokeDasharray.push(markerStartGap);
    }
    const markerEndGap = !!markerDetailsMap.markerEnd &&
      !!markerDetailsMap.markerEnd.markerAttributes
      ? markerDetailsMap.markerEnd.markerAttributes["data-gap"]
      : 0;
    const totalLength = getTotalLength();
    const nonMarkerEdgeLength = totalLength - (markerStartGap + markerEndGap);
    if (strokeDasharrayMidString) {
      const strokeDasharrayMid = strokeDasharrayMidString
        .split(/[,\ ]+/)
        .map(toFinite);
      const strokeDasharrayMidSectionLength = sum(strokeDasharrayMid);
      const repetitions = nonMarkerEdgeLength / strokeDasharrayMidSectionLength;
      const repetitionCount = floor(repetitions);
      const remainder = repetitions - repetitionCount;
      for (var i = 0; i < repetitionCount; i++) {
        strokeDasharrayMid.forEach(function(x) {
          strokeDasharray.push(x);
        });
      }
      strokeDasharray.push(remainder * strokeDasharrayMidSectionLength);
      if (strokeDasharray.length % 2 === 0) {
        // if even, next one will be a dash
        strokeDasharray.push(0);
      }
      strokeDasharray.push(markerEndGap);
    } else {
      strokeDasharray.push(nonMarkerEdgeLength);
      strokeDasharray.push(markerEndGap);
    }

    return (
      <path
        id={id}
        key={`${id}-path`}
        className={formatClassNames(type)}
        d={d}
        fill={"transparent"}
        fillOpacity="0"
        stroke={color}
        strokeDasharray={strokeDasharray.join(", ")}
        strokeWidth={borderWidth}
        {...omit("data-gap", markerProperties)}
      />
    );
  }
}
