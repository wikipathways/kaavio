import * as React from "react";
import * as ReactDom from "react-dom";
import { defaultsAll, isEmpty, keys, toPairs, values } from "lodash/fp";
import {
  FilterDefsProps,
  FilterProps,
  StringReferenceValue
} from "../../types";
import { normalizeElementId } from "../../utils/normalizeElementId";
import {
  formatSVGReference,
  getSVGReferenceType
} from "../../spinoffs/formatSVGReference";

import * as filterDrawerMap from "../../drawers/filters/index";

export const getSVGFilterReferenceType = (filterName: string) => {
  return getSVGReferenceType(filterName, ["string", "localIRI", "nonLocalIRI"]);
};

export function getNamespacedId(id: string): string {
  return normalizeElementId("kaavio" + id);
}

export function getNamespacedFilter(filterProps) {
  const { filterName } = filterProps;

  return filterDrawerMap[filterName]({
    getNamespacedId,
    ...filterProps
  });
}

export function getNamespacedFilterId(filterProps) {
  const { filterName } = filterProps;
  const svgReferenceType = getSVGFilterReferenceType(filterName);

  if (svgReferenceType === "localIRI") {
    // We can only tweak the color, stroke width, etc. for filters that are
    // located in this SVG (referenced via local IRIs)
    return getNamespacedFilter(filterProps).filterProperties.id;
  } else {
    return filterName;
  }
}

// Isn't the following the same as the one below?
export function getFilterReference1(filterProps) {
  const namespacedFilterId = getNamespacedFilterId(filterProps);
  return `url(#${namespacedFilterId})`;
}

/* Returns a filter reference like "url(file.svg#filter-element-id)"
 * See
 * https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/filter
 * https://developer.mozilla.org/en-US/docs/Web/CSS/filter
 */
export function getFilterReference({
  color,
  filterName,
  fill,
  strokeWidth,
  parentFill
}: FilterProps): StringReferenceValue | string {
  const svgReferenceType = getSVGFilterReferenceType(filterName);

  if (svgReferenceType === "string") {
    // Don't make a FuncIRI out of a string value
    return filterName;
  } else if (svgReferenceType === "nonLocalIRI") {
    // We can't set the color, etc. for a non-local IRI
    return formatSVGReference(filterName, [svgReferenceType]);
  }

  const namespacedFilterId = getNamespacedFilterId({
    color,
    filterName,
    fill,
    strokeWidth,
    parentFill
  });
  return formatSVGReference(namespacedFilterId, [svgReferenceType]);
}

export class FilterDefs extends React.Component<any, any> {
  constructor(props: FilterDefsProps) {
    super(props);
    const { pathway, entityMap, highlightedEntities } = props;

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
  // TODO re-enable this, but take into account potential clobbering of id globally
  //  componentWillReceiveProps(nextProps: FilterDefsProps) {
  //    const { state, props } = this;
  //    const { defined } = state;
  //    const { latestFilterReferenced } = nextProps;
  //    const definedIds = keys(defined);
  //    if (!isEmpty(latestFilterReferenced)) {
  //      const {
  //        fill,
  //        strokeWidth,
  //        color,
  //        filterName,
  //        parentFill
  //      } = latestFilterReferenced;
  //
  //      if (isEmpty(filterName)) {
  //        throw new Error(`Missing filterName`);
  //      }
  //
  //      const svgReferenceType = getSVGFilterReferenceType(filterName);
  //
  //      if (svgReferenceType === "localIRI") {
  //        // We can only tweak the color, stroke width, etc. for filters that are
  //        // located in this SVG (referenced via local IRIs)
  //
  //        const { filterProperties, filterPrimitives } = getNamespacedFilter({
  //          fill,
  //          strokeWidth,
  //          color,
  //          filterName,
  //          parentFill
  //        });
  //
  //        const id = filterProperties.id;
  //
  //        if (definedIds.indexOf(id) === -1) {
  //          defined[id] = { filterProperties, filterPrimitives };
  //          this.setState({
  //            defined
  //          });
  //        }
  //      }
  //    }
  //  }

  render() {
    const { defined } = this.state;

    return (
      <g id="jit-defs">
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
