//import "source-map-support/register";
import * as React from "react";
import * as ReactDom from "react-dom";
import { getHighlighted } from "../utils/getHighlighted";
import { Entity } from "./Entity";
import { Node } from "./Node";
import { getHidden } from "../utils/getHidden";
import { normalizeElementId } from "../utils/normalizeElementId";

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
      getPropsToPassDown,
      fillOpacity,
      mergedStyle,
      contains,
      id,
      hiddenEntities,
      getFilterId,
      defineMarker
    } = this.props;

    const children = contains
      .map(containedId => entityMap[containedId])
      .map(entity => {
        return (
          <Entity
            key={entity.id}
            // TODO are these merging ala defaults or what?
            {...getPropsToPassDown(this.props, entity)}
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
