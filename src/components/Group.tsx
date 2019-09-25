import * as React from "react";
import * as ReactDom from "react-dom";
import { Entity } from "./Entity";
import { Node } from "./Node";

/**
 * Higher order Group component.
 * Much of the implementation of a Group is the same as the Node, since a group is a node but with children...
 * See: https://medium.com/@franleplant/react-higher-order-components-in-depth-cf9032ee6c3e#.z5a94mm1b
 *
 * @returns {Group}
 */
export class Group extends React.Component<any, any> {
  constructor(wrappedNode: any) {
    super(wrappedNode.props);
  }
  render() {
    const { entitiesById, createChildProps, contains, id } = this.props;

    const children = contains
      .map(containedId => entitiesById[containedId])
      .map(entity => {
        return (
          <Entity
            key={entity.id}
            // TODO are these merging ala defaults or what?
            {...createChildProps(this.props, entity)}
          />
        );
      });

    return <Node key={id} {...this.props} children={children} />;
  }
}
