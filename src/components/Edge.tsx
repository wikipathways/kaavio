import { intersection, keys } from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getMarkerPropertyValue, MARKER_PROPERTIES } from "./Marker/Marker";
import { normalizeElementId } from "../utils/normalizeElementId";

export class Edge extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  // making sure we've defined any markers referenced after initial mount
  componentWillReceiveProps(nextProps) {
    const { defineMarker, color, parentBackgroundColor } = nextProps;
    intersection(MARKER_PROPERTIES, keys(nextProps)).forEach(function(
      markerProperty: MarkerProperty
    ) {
      const markerName = nextProps[markerProperty];
      if (markerName) {
        if (!!defineMarker) {
          defineMarker({
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
    const {
      id,
      drawAs,
      color,
      parentBackgroundColor,
      defineMarker,
      strokeDasharray,
      borderWidth,
      edgeDrawers,
      points,
      type
    } = this.props;

    const { d } = new edgeDrawers[(normalizeElementId(drawAs))](points);

    const markerProperties = intersection(MARKER_PROPERTIES, keys(this.props))
      /*
      .filter(markerProperty => {
        // Ensure only markerEnd, markerStart or markerMid
        // TODO is marker not allowed? if not, let's get rid of
        // it wherever it came from.
        const allowed = ["markerMid", "markerStart", "markerEnd"];
        return allowed.indexOf(markerProperty) > -1;
      })
			//*/
      .reduce((acc, markerProperty: MarkerProperty) => {
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
        key={`path-for-${id}`}
        className={type}
        d={d}
        fill={"transparent"}
        stroke={color}
        strokeDasharray={strokeDasharray}
        strokeWidth={borderWidth}
        id={id}
        {...markerProperties}
      />
    );
  }
}
