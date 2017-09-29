import * as React from "react";
import * as ReactDOM from "react-dom";

export const NON_FUNCIRI_VALUES = ["none", "inherit"];

export function getFilterUrl(
  filterName: string,
  color: string,
  parentBackgroundColor: string,
  strokeWidth: number
): string {
  // Don't make a funciri out of any of the names in NON_FUNCIRI_VALUES
  if (NON_FUNCIRI_VALUES.indexOf(filterName) > -1) {
    return filterName;
  }
  return `url(#${getId(
    filterName,
    color,
    parentBackgroundColor,
    strokeWidth
  )})`;
}

export function getId(
  filterName: string,
  color: string,
  parentBackgroundColor: string,
  strokeWidth: number
): string {
  return [filterName, color, parentBackgroundColor].join("");
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
      filterDrawer,
      color,
      parentBackgroundColor,
      strokeWidth
    } = this.props;

    const children = filterDrawer({
      parentBackgroundColor,
      color,
      strokeWidth
    });

    return <filter id={id} key={id} children={children} />;
  }
}
