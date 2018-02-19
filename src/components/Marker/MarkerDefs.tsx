import * as React from "react";
import * as ReactDom from "react-dom";
import { intersection, isEmpty, keys, toPairs, values } from "lodash/fp";
import { interpolate } from "../../spinoffs/interpolate";
import { getSVGReferenceType } from "../../spinoffs/formatSVGReference";
import { MarkerDefsProps, GetNamespacedMarkerId } from "../../types";
import { Marker } from "./Marker";

import { getSVGMarkerReferenceType, MARKER_PROPERTIES } from "./helpers";

export class MarkerDefs extends React.Component<any, any> {
  getNamespacedMarkerId: GetNamespacedMarkerId;
  constructor(props: MarkerDefsProps) {
    super(props);
    const {
      entitiesById,
      getNamespacedMarkerId,
      markerDrawerMap,
      pathway
    } = props;
    this.getNamespacedMarkerId = getNamespacedMarkerId;

    const parentFill = pathway.fill;

    const edges = values(entitiesById).filter(x => x.kaavioType === "Edge");

    const markerColors = Array.from(
      edges
        .filter(edge => edge.hasOwnProperty("stroke"))
        .reduce(function(acc, edge) {
          acc.add(edge.stroke);
          return acc;
        }, new Set())
    );

    const parentFills = [parentFill];
    Array.from(
      values(entitiesById)
        .filter(x => x.kaavioType === "Group")
        .reduce(function(acc, group) {
          const fill = interpolate(parentFill, group.fill, group.fillOpacity);
          acc.add(fill);
          return acc;
        }, new Set())
    ).forEach(function(groupColor: string) {
      parentFills.push(groupColor);
    });

    const localMarkerNames = Array.from(
      edges.reduce(function(acc, edge: any) {
        intersection(MARKER_PROPERTIES, keys(edge))
          .map((markerProperty: string): string => edge[markerProperty])
          // The only markers that need defs are the ones that have funciris
          // (functional IRIs) as marker properties. Markers with other marker
          // properties like "none" and "inherit" don't need defs.
          // See https://www.w3.org/TR/SVG11/painting.html#MarkerProperties
          .filter(
            (markerName: string) =>
              getSVGMarkerReferenceType(markerName) === "localIRI"
          )
          .forEach(function(markerName) {
            if (markerDrawerMap.hasOwnProperty(markerName)) {
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
      .map(stroke => ({ stroke: stroke }))
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          parentFills.map(function(parentFill) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.parentFill = parentFill;
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
          localMarkerNames.map(function(markerName) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerName = markerName;
              return subAcc;
            }, {});
          })
        );
      }, []) as any[];

    this.state = { defined, markerDrawerMap };
  }

  /* If the diagram is updated after the initial render, this step will handle
	 * the case of needing a marker definition that wasn't defined in the
	 * constructor, such as if a user were to add a new group with a background
	 * color that was not present initially and then dragged a marker on top of a
	 * type of that group. This doesn't do anything on server-side rendering.
	 */
  componentWillReceiveProps(nextProps: MarkerDefsProps) {
    const { getNamespacedMarkerId, state, props } = this;
    const { defined } = state;
    const { latestMarkerReferenced, markerDrawerMap } = nextProps;
    if (!isEmpty(latestMarkerReferenced)) {
      const { markerProperty, markerName } = latestMarkerReferenced;

      if (getSVGMarkerReferenceType(markerName) === "localIRI") {
        const namespacedMarkerId = getNamespacedMarkerId(
          latestMarkerReferenced
        );
        if (keys(defined).indexOf(namespacedMarkerId) === -1) {
          defined[namespacedMarkerId] = {
            markerProperty,
            markerName
          };
          // TODO should we ever update markerDrawerMap?
          this.setState({
            defined: defined,
            markerDrawerMap: markerDrawerMap
          });
        }
      }
    }
  }

  render() {
    const { getNamespacedMarkerId } = this;
    const { defined, markerDrawerMap } = this.state;

    return (
      <g id="marker-defs">
        {toPairs(defined).map(([namespacedMarkerId, details]) => {
          const { markerProperty, markerName } = details;
          return (
            <Marker
              id={namespacedMarkerId}
              key={namespacedMarkerId}
              getNamespacedMarkerId={getNamespacedMarkerId}
              markerDrawer={markerDrawerMap[markerName]}
              markerName={markerName}
              markerProperty={markerProperty}
            />
          );
        })}
      </g>
    );
  }
}
