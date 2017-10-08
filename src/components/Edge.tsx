import { intersection, keys } from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getMarkerPropertyValue, MARKER_PROPERTIES } from "./Marker/Marker";
import * as edgeDrawers from "../drawers/edges/__bundled_dont_edit__";

export class Edge extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  // making sure we've defined any markers referenced after initial mount
  componentWillReceiveProps(nextProps) {
    const { getMarkerId, color, parentBackgroundColor } = nextProps;
    intersection(MARKER_PROPERTIES, keys(nextProps)).forEach(function(
      markerProperty: MarkerProperty
    ) {
      const markerName = nextProps[markerProperty];
      if (markerName) {
        if (!!getMarkerId) {
          getMarkerId({
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
      getMarkerId,
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
