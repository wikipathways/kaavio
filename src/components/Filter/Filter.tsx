import * as React from "react";
import * as ReactDOM from "react-dom";
//import * as filterDrawers from "../../drawers/filters/__bundled_dont_edit__";
import * as filterDrawers from "../../drawers/filters/index";
import { normalizeElementId } from "../../utils/normalizeElementId";

export const NON_FUNCIRI_VALUES = ["none", "inherit"];

export function getFilterUrl(
  filterName: string,
  color: string,
  parentBackgroundColor: string,
  borderWidth: number
): string {
  // Don't make a funciri out of any of the names in NON_FUNCIRI_VALUES
  if (NON_FUNCIRI_VALUES.indexOf(filterName) > -1) {
    return filterName;
  }
  return `url(#${getId(
    filterName,
    parentBackgroundColor,
    color,
    borderWidth
  )})`;
}

export function getId(
  filterName: string,
  parentBackgroundColor: string,
  color: string,
  borderWidth: number
): string {
  return normalizeElementId(
    [filterName, color, parentBackgroundColor, borderWidth].join("")
  );
}

/* TODO which one should we use?
export class Filter extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { ...props };
  }
  render() {
    const { id, children } = this.state;
    return <filter id={id} key={id} children={children} />;
  }
}
//*/
export class Filter extends React.Component<any, any> {
  constructor() {
    super();
  }

  render() {
    const {
      id,
      filterName,
      parentBackgroundColor,
      color,
      borderWidth
    } = this.props;

    const filterDrawer = filterDrawers[filterName];
    const children = filterDrawer({
      parentBackgroundColor,
      color,
      strokeWidth: borderWidth
    });

    return <filter id={id} children={children} />;
  }
}
