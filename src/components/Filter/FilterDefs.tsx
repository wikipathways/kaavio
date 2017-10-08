import * as React from "react";
import * as ReactDom from "react-dom";
import { defaults, isEmpty, keys, toPairs, values } from "lodash/fp";
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
          const { filterProperties, filterPrimitives } = filterDrawers[
            filterName
          ]({
            parentBackgroundColor: entity.parentBackgroundColor,
            color: entity.color,
            strokeWidth: entity.borderWidth
          });
          acc[filterProperties.id] = { filterProperties, filterPrimitives };
        });
        return acc;
      }, {});

    const definedFromHighlights = (highlightedEntities || [])
      .reduce(function(acc, highlightedEntity) {
        const { filterProperties, filterPrimitives } = filterDrawers[
          "Highlight"
        ]({
          color: highlightedEntity.color
        });
        acc[filterProperties.id] = { filterProperties, filterPrimitives };
        return acc;
      }, {});

    this.state = {
      defined: defaults(definedFromEntities, definedFromHighlights)
    };
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
    const { latestFilterReferenced } = nextProps;
    const definedIds = keys(defined);
    if (!isEmpty(latestFilterReferenced)) {
      const {
        filterName,
        parentBackgroundColor,
        color,
        borderWidth
      } = latestFilterReferenced;

      console.log("filterDrawers");
      console.log(filterDrawers);
      console.log("latestFilterReferenced");
      console.log(latestFilterReferenced);
      if (isEmpty(filterName)) {
        throw new Error(`Missing filterName`);
      }
      const { filterProperties, filterPrimitives } = filterDrawers[filterName]({
        parentBackgroundColor: parentBackgroundColor,
        color: color,
        strokeWidth: borderWidth
      });
      const id = filterProperties.id;

      if (definedIds.indexOf(id) === -1) {
        defined[id] = { filterProperties, filterPrimitives };
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
        {toPairs(
          defined
        ).map(([filterId, { filterProperties, filterPrimitives }]) => {
          return (
            <filter key={filterId} {...filterProperties}>
              {filterPrimitives}
            </filter>
          );
        })}
      </g>
    );
  }
}
