import * as React from "react";
import * as ReactDom from "react-dom";
import { intersection, keys, toPairs, values } from "lodash";
import { interpolate } from "../../spinoffs/interpolate";

import { getId, Filter } from "./Filter";
//import * as filterDrawers from "../../drawers/filters/__bundled_dont_edit__";
import * as filterDrawers from "../../drawers/filters/index";

export class FilterDefs extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const {
      pathway,
      entityMap
    }: { pathway: Record<string, any>; entityMap: Record<string, any> } = props;
    const parentBackgroundColor = pathway.backgroundColor;

    const edges = values(entityMap).filter(x => x.kaavioType === "Edge");

    const filterColors = Array.from(
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

    const defined = filterColors
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
      }, []);

    this.state = { defined: defined };
  }

  /* If the diagram is updated after the initial render, this step will handle
	 * the case of needing a filter definition that wasn't defined in the
	 * constructor, such as if a user were to add a new group with a background
	 * color that was not present initially and then dragged a filter on top of a
	 * type of that group. This doesn't do anything on server-side rendering.
	 */
  componentWillReceiveProps(nextProps) {
    const { state, props } = this;
    const { defined } = state;
    const { latestMarkerReferenced } = nextProps;
    if (latestMarkerReferenced) {
      const {
        filterName,
        color,
        parentBackgroundColor,
        strokeWidth
      } = latestMarkerReferenced;

      const filterId = getId(
        filterName,
        color,
        parentBackgroundColor,
        strokeWidth
      );
      if (keys(defined).indexOf(filterId) === -1) {
        defined[filterId] = {
          filterName,
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
      <g>
        {toPairs(defined).map(([filterId, details]) => {
          const { filterName, color, parentBackgroundColor } = details;
          return (
            <Filter
              id={filterId}
              key={filterId}
              color={color}
              parentBackgroundColor={parentBackgroundColor}
              filterDrawer={filterDrawers[filterName]}
            />
          );
        })}
      </g>
    );
  }
}
