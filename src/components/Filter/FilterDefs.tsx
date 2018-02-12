import * as React from "react";
import * as ReactDom from "react-dom";
import { defaultsAll, find, isEmpty, keys, toPairs, values } from "lodash/fp";
import { getSVGReferenceType } from "../../spinoffs/formatSVGReference";
import { FilterDefsProps, GetNamespacedFilter } from "../../types";

export const getSVGFilterReferenceType = (filterName: string) => {
  return getSVGReferenceType(filterName, ["string", "localIRI", "nonLocalIRI"]);
};

export class FilterDefs extends React.Component<any, any> {
  getNamespacedFilter: GetNamespacedFilter;
  constructor(props: FilterDefsProps) {
    super(props);
    const {
      pathway,
      entityMap,
      getNamespacedFilter,
      highlightedEntities
    } = props;
    this.getNamespacedFilter = getNamespacedFilter;

    const entityValues = values(entityMap);

    const definedFromBorderStyleDouble = entityValues
      .filter(
        entity =>
          entity.hasOwnProperty("borderStyle") &&
          entity.borderStyle === "double"
      )
      .reduce(function(acc, entity) {
        const { filterProperties, filterPrimitives } = getNamespacedFilter({
          filterName: "Double",
          ...entity
        });

        acc[filterProperties.id] = { filterProperties, filterPrimitives };
        return acc;
      }, {});

    const definedFromEntityFilterProperties = entityValues
      .filter(entity => entity.hasOwnProperty("filters"))
      .reduce(function(acc, entity) {
        entity.filters
          // NOTE: yes, this is funny, but SVG filter is different from JS filter
          .filter(
            filterName => getSVGFilterReferenceType(filterName) === "localIRI"
          )
          .forEach(function(filterName) {
            const { filterProperties, filterPrimitives } = getNamespacedFilter({
              filterName,
              ...entity
            });
            acc[filterProperties.id] = { filterProperties, filterPrimitives };
          });
        return acc;
      }, {});

    const definedFromHighlights = (highlightedEntities || [])
      .reduce(function(acc, highlightedEntity) {
        const filterName = "Highlight";
        const { filterProperties, filterPrimitives } = getNamespacedFilter({
          color: highlightedEntity.color,
          filterName
        });

        acc[filterProperties.id] = { filterProperties, filterPrimitives };
        return acc;
      }, {});

    const definedFromBlackToColor = entityValues
      .filter(entity => entity.hasOwnProperty("color"))
      .reduce(function(acc, entity) {
        const filterName = "BlackToColor";
        const { filterProperties, filterPrimitives } = getNamespacedFilter({
          color: entity.color,
          filterName
        });

        acc[filterProperties.id] = { filterProperties, filterPrimitives };
        return acc;
      }, {});

    const definedFromWhiteToColor = entityValues
      .filter(entity => entity.hasOwnProperty("color"))
      .reduce(function(acc, entity) {
        const filterName = "WhiteToColor";
        const { filterProperties, filterPrimitives } = getNamespacedFilter({
          color: entity.color,
          filterName
        });

        acc[filterProperties.id] = { filterProperties, filterPrimitives };
        return acc;
      }, {});

    this.state = {
      defined: defaultsAll([
        definedFromEntityFilterProperties,
        definedFromBorderStyleDouble,
        definedFromHighlights,
        definedFromBlackToColor,
        definedFromWhiteToColor
      ])
    };
  }

  /* If the diagram is updated after the initial render, this step will handle
	 * the case of needing a filter definition that wasn't defined in the
	 * constructor, such as if a user were to add a new group with a background
	 * color that was not present initially and then dragged a filter on top of a
	 * type of that group. This doesn't do anything on server-side rendering.
	 */
  componentWillReceiveProps(nextProps: FilterDefsProps) {
    const { getNamespacedFilter, state, props } = this;
    const { defined } = state;
    const { latestFilterReferenced } = nextProps;
    const definedIds = keys(defined);
    if (!isEmpty(latestFilterReferenced)) {
      const {
        backgroundColor,
        borderWidth,
        color,
        filterName,
        parentBackgroundColor
      } = latestFilterReferenced;

      if (isEmpty(filterName)) {
        throw new Error(`Missing filterName`);
      }

      const svgReferenceType = getSVGFilterReferenceType(filterName);

      if (svgReferenceType === "localIRI") {
        // We can only tweak the color, border width, etc. for filters that are
        // located in this SVG (referenced via local IRIs)

        const { filterProperties, filterPrimitives } = getNamespacedFilter({
          backgroundColor,
          borderWidth,
          color,
          filterName,
          parentBackgroundColor
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
  }

  render() {
    const { defined } = this.state;

    return (
      <g id="calculated-filter-defs">
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
