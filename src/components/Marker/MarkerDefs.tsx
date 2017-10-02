import * as React from "react";
import * as ReactDom from "react-dom";
import { intersection, keys, toPairs, values } from "lodash";
import { interpolate } from "../../spinoffs/interpolate";

import {
  getMarkerId,
  Marker,
  MARKER_PROPERTIES,
  NON_FUNCIRI_MARKER_PROPERTY_VALUES
} from "./Marker";
import * as markerDrawers from "../../drawers/markers/__bundled_dont_edit__";

export class MarkerDefs extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const {
      pathway,
      entityMap
    }: { pathway: Record<string, any>; entityMap: Record<string, any> } = props;
    const parentBackgroundColor = pathway.backgroundColor;

    const edges = values(entityMap).filter(x => x.kaavioType === "Edge");

    const markerColors = Array.from(
      edges
        .filter(edge => edge.hasOwnProperty("color"))
        .reduce(function(acc, edge) {
          acc.add(edge.color);
          return acc;
        }, new Set())
    );

    const parentBackgroundColors = [parentBackgroundColor];
    Array.from(
      values(entityMap)
        .filter(x => x.kaavioType === "Group")
        .reduce(function(acc, group) {
          const fill = interpolate(
            parentBackgroundColor,
            group.backgroundColor,
            group.fillOpacity
          );
          acc.add(fill);
          return acc;
        }, new Set())
    ).forEach(function(groupColor: string) {
      parentBackgroundColors.push(groupColor);
    });

    const markerNames = Array.from(
      edges.reduce(function(acc, edge: any) {
        intersection(MARKER_PROPERTIES, keys(edge))
          .map((markerProperty: string): string => edge[markerProperty])
          // The only markers that need defs are the ones that have funciris
          // (functional IRIs) as marker properties. Markers with other marker
          // properties like "none" and "inherit" don't need defs.
          // See https://www.w3.org/TR/SVG11/painting.html#MarkerProperties
          .filter(
            (markerName: string & NonFunciriMarkerPropertyValue) =>
              NON_FUNCIRI_MARKER_PROPERTY_VALUES.indexOf(markerName) === -1
          )
          .forEach(function(markerName) {
            if (markerDrawers.hasOwnProperty(markerName)) {
              acc.add(markerName);
            } else {
              // Can't draw it if we don't have a markerDrawer for it.
              console.warn(`Missing markerDrawer for "${markerName}"`);
            }
          });
        return acc;
      }, new Set())
    );

    const defined = markerColors
      .map(color => ({ color: color }))
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          parentBackgroundColors.map(function(parentBackgroundColor) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.parentBackgroundColor = parentBackgroundColor;
              return subAcc;
            }, {});
          })
        );
      }, [])
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          MARKER_PROPERTIES.map(function(markerProperty) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerProperty = markerProperty;
              return subAcc;
            }, {});
          })
        );
      }, [])
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          markerNames.map(function(markerName) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerName = markerName;
              return subAcc;
            }, {});
          })
        );
      }, []) as any[];

    this.state = { defined: defined };
  }

  /* If the diagram is updated after the initial render, this step will handle
	 * the case of needing a marker definition that wasn't defined in the
	 * constructor, such as if a user were to add a new group with a background
	 * color that was not present initially and then dragged a marker on top of a
	 * type of that group. This doesn't do anything on server-side rendering.
	 */
  componentWillReceiveProps(nextProps) {
    const { state, props } = this;
    const { defined } = state;
    const { latestMarkerReferenced } = nextProps;
    if (latestMarkerReferenced) {
      const {
        markerProperty,
        markerName,
        color,
        parentBackgroundColor
      } = latestMarkerReferenced;

      const markerId = getMarkerId(
        markerProperty,
        markerName,
        color,
        parentBackgroundColor
      );
      if (keys(defined).indexOf(markerId) === -1) {
        defined[markerId] = {
          markerProperty,
          markerName,
          color,
          parentBackgroundColor
        };
        this.setState({
          defined: defined
        });
      }
    }
  }

  render() {
    const { defined } = this.state;

    return (
      <g id="marker-defs">
        {toPairs(defined).map(([markerId, details]) => {
          const {
            markerProperty,
            markerName,
            color,
            parentBackgroundColor
          } = details;
          return (
            <Marker
              key={markerId}
              color={color}
              parentBackgroundColor={parentBackgroundColor}
              markerName={markerName}
              markerProperty={markerProperty}
              markerDrawer={markerDrawers[markerName]}
            />
          );
        })}
      </g>
    );
  }
}
