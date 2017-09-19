import { intersection, keys, forOwn } from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getMarkerPropertyValue, MARKER_PROPERTY_NAMES } from "./Marker";
import { normalizeElementId } from "../utils/normalizeElementId";

export class Edge extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const {
      id,
      drawAs,
      color,
      backgroundColor,
      strokeDasharray,
      borderWidth,
      edgeDrawers,
      points,
      type
    } = this.props;

    const normalizedDrawAs = normalizeElementId(drawAs);
    const { d } = new edgeDrawers[normalizedDrawAs](points);

    const markerProperties = intersection(
      MARKER_PROPERTY_NAMES,
      keys(this.props)
    ).reduce((acc: any[], markerLocationType: MarkerPropertyName) => {
      const markerName = this.props[markerLocationType];
      if (markerName) {
        acc.push({
          name: markerLocationType,
          // Currently just using the same color for backgroundColor (arrow head) as color (line)
          // See line 86 in Kaavio.tsx
          value: getMarkerPropertyValue(
            markerLocationType,
            markerName,
            color,
            backgroundColor
          )
        });
      }
      return acc;
    }, []) as any[];

    const opts = markerProperties
      .filter(attribute => {
        // Ensure only markerEnd, markerStart or markerMid
        const allowed = ["markerMid", "markerStart", "markerEnd"];
        return allowed.indexOf(attribute.name) > -1;
      })
      .reduce(
        function(acc, { name, value }) {
          acc[name] = value;
          return acc;
        },
        {
          className: type,
          d: d,
          fill: "transparent",
          stroke: color,
          strokeDasharray: strokeDasharray,
          strokeWidth: borderWidth,
          id: id
        }
      );

    return <path key={`path-for-${id}`} {...opts} />;
  }
}
