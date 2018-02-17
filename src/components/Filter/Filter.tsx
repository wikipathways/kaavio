import * as React from "react";
import * as ReactDom from "react-dom";
import { unionLSV } from "../../spinoffs/jsonld-utils";
import { defaults } from "lodash/fp";
import { EntityProps } from "../../types";
import { getFilterReference } from "./FilterDefs";

/**
 */
export class Filter extends React.Component<any, any> {
  constructor(props: EntityProps) {
    super(props);
  }

  /*
  componentWillReceiveProps(nextProps) {
    const { filters } = this.props;
    const { filters: nextFilters, setFilter } = nextProps;
    if (filters !== nextFilters) {
      nextFilters.forEach(function(nextFilterName) {
        setFilter({ filterName: nextFilterName, ...nextProps });
      });
    }
  }
	//*/

  render() {
    const { props } = this;

    const {
      borderStyle,
      childTag,
      childOnlyProps,
      firstChildStyleProps,
      parentFill
    } = props;

    const { className, color, fill, strokeWidth } = firstChildStyleProps;

    let filters = props.filters || [];

    if (borderStyle === "double") {
      filters = unionLSV(filters, "Double");
    }

    const filterCount = filters.length;
    const filtersAreUsed = filterCount > 0;
    const descendantStyle = {
      color: "inherit",
      fill: "inherit",
      fillOpacity: "inherit",
      stroke: "inherit",
      strokeWidth: "inherit"
    };

    const ChildTag = childTag;
    if (!filtersAreUsed) {
      return <ChildTag {...defaults(childOnlyProps, firstChildStyleProps)} />;
    } else {
      return filters.reduce(function(acc, filterName, i) {
        const filterReference = getFilterReference({
          color,
          filterName,
          fill,
          strokeWidth,
          parentFill
        });
        let props: Record<string, any> = {};
        if (i + 1 === filterCount) {
          // this is the final (outermost) g element with a filter
          props = firstChildStyleProps;
        } else {
          props.style = descendantStyle;
        }

        return (
          <g filter={filterReference} {...props}>
            {acc}
          </g>
        );
      }, <ChildTag style={descendantStyle} {...childOnlyProps} />);
    }
  }
}
