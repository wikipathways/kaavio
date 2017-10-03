import * as React from "react";
import * as ReactDom from "react-dom";
import { defaults, keys, toPairs, values } from "lodash/fp";
import { interpolate } from "../../spinoffs/interpolate";
import * as filterDrawers from "../../drawers/filters/__bundled_dont_edit__";

export class FilterDefs extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const {
      pathway,
      entityMap,
      highlightedEntities
    }: {
      pathway: Record<string, any>;
      entityMap: Record<string, any>;
      highlightedEntities: Record<string, any>;
    } = props;
    const definedFromEntities = values(entityMap)
      .filter(entity => entity.hasOwnProperty("filters"))
      .reduce(function(acc, entity) {
        entity.filters.forEach(function(filterName) {
          const { id, filterPrimitives } = filterDrawers[filterName]({
            parentBackgroundColor: entity.parentBackgroundColor,
            color: entity.color,
            strokeWidth: entity.borderWidth
          });
          acc[id] = filterPrimitives;
        });
        return acc;
      }, {});

    const definedFromHighlights = (highlightedEntities || [])
      .reduce(function(acc, highlightedEntity) {
        const { id, filterPrimitives } = filterDrawers["Highlight"]({
          color: highlightedEntity.color
        });
        acc[id] = filterPrimitives;
        return acc;
      }, {});

    this.state = {
      defined: defaults(definedFromEntities, definedFromHighlights)
    };
  }

  /*
  getId = ({
    filterName,
    parentBackgroundColor,
    color,
    borderWidth
  }): string => {
    const { defined } = this.state;
    const { id, filterPrimitives } = filterDrawers[filterName]({
      parentBackgroundColor: parentBackgroundColor,
      color: color,
      strokeWidth: borderWidth
    });

    const definedIds = keys(defined);
    if (definedIds.indexOf(id) === -1) {
      defined[id] = filterPrimitives;
      // NOTE: side effect
      this.setState({
        defined
      });
    }

    return id;
  };
	//*/

  /* If the diagram is updated after the initial render, this step will handle
	 * the case of needing a filter definition that wasn't defined in the
	 * constructor, such as if a user were to add a new group with a background
	 * color that was not present initially and then dragged a filter on top of a
	 * type of that group. This doesn't do anything on server-side rendering.
	 */
  componentWillReceiveProps(nextProps) {
    const { state, props } = this;
    const { defined } = state;
    const { latestFilterReferenced } = nextProps;
    const definedIds = keys(defined);
    if (latestFilterReferenced) {
      const {
        filterName,
        parentBackgroundColor,
        color,
        borderWidth
      } = latestFilterReferenced;

      const { id, filterPrimitives } = filterDrawers[filterName]({
        parentBackgroundColor: parentBackgroundColor,
        color: color,
        strokeWidth: borderWidth
      });

      if (definedIds.indexOf(id) === -1) {
        defined[id] = filterPrimitives;
        this.setState({
          defined
        });
      }
    }
  }

  render() {
    const { defined } = this.state;

    return (
      <g id="filter-defs">
        {toPairs(defined).map(([filterId, filterPrimitives]) => {
          return (
            <filter id={filterId} key={filterId}>
              {filterPrimitives}
            </filter>
          );
        })}
      </g>
    );
  }
}
