//import "source-map-support/register";
import * as React from "react";
import * as ReactDom from "react-dom";
import { getHighlighted } from "../utils/getHighlighted";
import { Entity } from "./Entity";
import { Node } from "./Node";
import { getHidden } from "../utils/getHidden";
import { normalizeElementId } from "../utils/normalizeElementId";
import { interpolate } from "../spinoffs/interpolate";

// Must also export this class for type definitions to work
export class nodeWithGroup extends React.Component<any, any> {
  constructor(wrappedNode: any) {
    super(wrappedNode.props);
  }
  render() {
    const {
      x,
      y,
      entityMap,
      highlightedNodes,
      backgroundColor,
      parentBackgroundColor,
      fillOpacity,
      mergedStyle,
      contains,
      id,
      hiddenEntities,
      defineFilter,
      defineMarker
    } = this.props;

    const interpolatedBackgroundColor = interpolate(
      parentBackgroundColor,
      backgroundColor,
      fillOpacity
    );

    const children = contains
      .map(containedId => entityMap[containedId])
      .map(entity => {
        const highlighted = getHighlighted(entity, highlightedNodes);
        const hidden = getHidden(entity, hiddenEntities);
        return (
          <Entity
            key={entity.id}
            {...entity}
            parentBackgroundColor={interpolatedBackgroundColor}
            mergedStyle={mergedStyle}
            entityMap={entityMap}
            isHighlighted={highlighted.highlighted}
            highlightedColor={highlighted.color}
            highlightedNodes={highlightedNodes}
            hidden={hidden}
            hiddenEntities={hiddenEntities}
            defineFilter={defineFilter}
            defineMarker={defineMarker}
          />
        );
      });

    return <Node key={id} {...this.props} children={children} />;
  }
}

/**
 * Higher order Group component.
 * Much of the implementation of a Group is the same as the Node, since a group is a node but with children...
 * See: https://medium.com/@franleplant/react-higher-order-components-in-depth-cf9032ee6c3e#.z5a94mm1b
 *
 * @returns {Group}
 */
export const Group = wrappedNode => new nodeWithGroup(wrappedNode);
