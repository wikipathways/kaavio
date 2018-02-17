import {
  concat,
  floor,
  intersection,
  keys,
  omit,
  round,
  sum,
  toFinite
} from "lodash/fp";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { unionLSV } from "../spinoffs/jsonld-utils";
import {
  createMarkerId,
  getSVGMarkerReferenceType,
  MARKER_PROPERTIES
} from "./Marker/helpers";
import { formatClassNames } from "../utils/formatClassNames";
import { formatSVGReference } from "../spinoffs/formatSVGReference";
import { MarkerProperty, StringReferenceValue } from "../types";
import { Filter } from "./Filter/Filter";

const STROKE_DASHARRAY_ROUNDING_FACTOR = 100;
function roundForStrokeDasharraySegment(n) {
  return (
    round(n * STROKE_DASHARRAY_ROUNDING_FACTOR) /
    STROKE_DASHARRAY_ROUNDING_FACTOR
  );
}

export class Edge extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  getMarkerPropertyValue = (
    markerProperty: MarkerProperty,
    markerName: StringReferenceValue & string
  ): StringReferenceValue | string => {
    const svgReferenceType = getSVGMarkerReferenceType(markerName);

    if (svgReferenceType === "string") {
      // Don't make a FuncIRI out of a string value
      return markerName;
    } else if (svgReferenceType === "nonLocalIRI") {
      // We can't set the color, etc. for a non-local IRI
      return formatSVGReference(markerName, [svgReferenceType]);
    }

    return formatSVGReference(createMarkerId(markerProperty, markerName), [
      svgReferenceType
    ]);
  };

  render() {
    const { getMarkerPropertyValue, props } = this;
    const {
      id,
      color,
      drawAs,
      strokeDasharray: strokeDasharrayPatternString,
      strokeWidth,
      points,
      theme,
      type,
      borderStyle,
      height,
      parentFill,
      stroke,
      style
    } = props;
    let filters = props.filters || [];

    const { Defs } = theme;

    const { d, getTotalLength } = new theme[drawAs](points);

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
      const markerId = createMarkerId(markerProperty, markerName);
      acc[markerProperty] = Defs.jic[markerId];
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
    const strokeDasharrayWithMarkerOffsets = [];
    const markerStartOffset = !!markerDetailsMap.markerStart &&
      !!markerDetailsMap.markerStart.contextStrokeDashoffset
      ? markerDetailsMap.markerStart.contextStrokeDashoffset
      : 0;
    if (markerStartOffset) {
      strokeDasharrayWithMarkerOffsets.push(0);
      strokeDasharrayWithMarkerOffsets.push(markerStartOffset);
    }
    const markerEndOffset = !!markerDetailsMap.markerEnd &&
      !!markerDetailsMap.markerEnd.contextStrokeDashoffset
      ? markerDetailsMap.markerEnd.contextStrokeDashoffset
      : 0;
    let distanceToEndOffset =
      getTotalLength() - markerStartOffset - markerEndOffset;
    if (strokeDasharrayPatternString) {
      const strokeDasharrayPatternHalfOrFull = strokeDasharrayPatternString
        .split(/[,\ ]+/)
        .map(toFinite);
      // See MDN -- if stroke-dasharray has an odd number of segments, it is concatenated with itself.
      const strokeDasharrayPattern = strokeDasharrayPatternHalfOrFull.length %
        2 ===
        0
        ? strokeDasharrayPatternHalfOrFull
        : concat(
            strokeDasharrayPatternHalfOrFull,
            strokeDasharrayPatternHalfOrFull
          );
      const strokeDasharrayPatternSegmentCount = strokeDasharrayPattern.length;

      const strokeDasharrayPatternSummedLength = sum(strokeDasharrayPattern);
      const firstDashLength = strokeDasharrayPattern[0];
      const repetitionCount = floor(
        (distanceToEndOffset - firstDashLength) /
          strokeDasharrayPatternSummedLength
      );
      // NOTE: if strokeDasharrayPatternSummedLength is very large and the edge is very short,
      // we could inadvertently make a huge change to the strokeDasharray.
      // We only want to try making a subtle adjustment so as to get the edge to
      // terminate with a dash into the end marker. If it's not subtle (<20% change),
      // we'll just stick with the original scale and cut it off wherever it ends.
      // NOTE: scaleFactor will always be positive, because we used floor() above.
      const scaleFactor = Math.min(
        1.2,
        distanceToEndOffset /
          (repetitionCount * strokeDasharrayPatternSummedLength +
            firstDashLength)
      );

      const maxRoundingError = 1 / STROKE_DASHARRAY_ROUNDING_FACTOR;
      do {
        for (let i = 0; i < strokeDasharrayPatternSegmentCount; i++) {
          if (distanceToEndOffset <= maxRoundingError) {
            break;
          }
          const segmentLengthOnDeck = scaleFactor * strokeDasharrayPattern[i];
          let segmentLength;
          if (2 * segmentLengthOnDeck > distanceToEndOffset) {
            segmentLength = segmentLengthOnDeck;
          } else {
            if (strokeDasharrayPatternSegmentCount % 2 === 0) {
              segmentLength = Math.min(
                segmentLengthOnDeck,
                distanceToEndOffset
              );
            } else {
              // We want the edge to terminate into the end marker with
              // a dash that is long enough to be visible.
              // If we reach this part of the code, the segment on deck is a gap,
              // because strokeDasharrayWithMarkerOffsets.length is odd,
              // but the subsequent dash would be shorter than this gap and hence
              // too short to be visible (assuming the user-specified gap is visible).
              // So in this case, we "skip" the final gap by pushing an empty gap and
              // filling the rest of the distance to the end marker with a dash.
              // TODO is it possible to reach this section?
              console.warn("Adding a placeholder empty gap inside while loop.");
              strokeDasharrayWithMarkerOffsets.push(0);
              segmentLength = distanceToEndOffset;
            }
          }
          const segmentLengthRounded = roundForStrokeDasharraySegment(
            segmentLength
          );
          strokeDasharrayWithMarkerOffsets.push(segmentLengthRounded);
          distanceToEndOffset -= segmentLengthRounded;
        }
      } while (distanceToEndOffset > maxRoundingError);
      if (strokeDasharrayWithMarkerOffsets.length % 2 === 0) {
        // if even, next segment will be a dash, but we want it to be a gap,
        // so we "skip" this dash by making it zero-length.
        strokeDasharrayWithMarkerOffsets.push(0);
      }
    } else {
      strokeDasharrayWithMarkerOffsets.push(distanceToEndOffset);
    }
    strokeDasharrayWithMarkerOffsets.push(markerEndOffset);

    //*
    // NOTE: this is a kludge to deal with SVG not
    // allowing for defining marker color in relation
    // to the color of the element that refernces the
    // marker.
    // We're setting edge + marker color by doing
    // a filter transformation from black to
    // the desired color.
    if (!!color) {
      filters = unionLSV(filters, "BlackToColor");
    }
    let firstChildStyleProps = {
      color: stroke,
      fill: "transparent",
      fillOpacity: 0,
      stroke: "black",
      strokeDasharray: strokeDasharrayWithMarkerOffsets.join(", "),
      strokeWidth: strokeWidth
    };
    let childOnlyProps = {
      id,
      key: `${id}-path`,
      d,
      ...markerProperties
    };
    //*/

    //stroke={color}

    return (
      <Filter
        borderStyle={borderStyle}
        childTag="path"
        parentFill={parentFill}
        filters={filters}
        childOnlyProps={{
          ...childOnlyProps,
          ...{ className: "EdgeBody" }
        }}
        firstChildStyleProps={firstChildStyleProps}
      />
    );
  }
}
