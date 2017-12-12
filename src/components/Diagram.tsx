import * as React from "react";
import * as ReactDom from "react-dom";
import {
  assign,
  assignAll,
  curry,
  defaults,
  defaultsDeep,
  defaultsAll,
  filter,
  forOwn,
  isArray,
  isBoolean,
  isNumber,
  isString,
  kebabCase,
  omitBy,
  map,
  pick,
  reduce,
  set,
  toPairs,
  values
} from "lodash/fp";
import { formatClassNames } from "../utils/formatClassNames";
import {
  GetNamespacedId,
  LatestFilterReferenced,
  LatestMarkerReferenced,
  GetNamespacedFilter,
  GetNamespacedFilterId,
  GetNamespacedMarkerId
} from "../types";
import { Entity } from "./Entity";
import { FilterDefs, getSVGFilterReferenceType } from "./Filter/FilterDefs";
import { MarkerDefs } from "./Marker/MarkerDefs";
import { getSVGMarkerReferenceType } from "./Marker/helpers";
const kaavioStyleSVG = require("../kaavioStyleSVG.css");
import { interpolate } from "../spinoffs/interpolate";
import { normalizeElementId } from "../utils/normalizeElementId";

const BOX_MODEL_DEFAULTS = {
  padding: 0, // px
  verticalAlign: "top"
};
const TEXT_CONTENT_DEFAULTS = {
  color: "#141414",
  fontFamily: "arial",
  fontSize: 12, // px
  lineHeight: 1.5, // unitless
  textAlign: "start",
  whiteSpace: "pre"
};

export class Diagram extends React.Component<any, any> {
  filterDrawerMap: Record<string, Function>;
  getNamespacedId: GetNamespacedId;
  constructor(props) {
    super(props);
    const { customStyleSVG, filterDrawerMap, pathway } = props;
    this.filterDrawerMap = filterDrawerMap;

    const { id } = pathway;
    let diagramNamespace;
    if ("@context" in props && "@base" in props["@context"]) {
      diagramNamespace = props["@context"]["@base"];
    } else if (id) {
      const lastCharacter = id.slice(-1);
      if (["#", "/"].indexOf(lastCharacter) > -1) {
        diagramNamespace = id;
      } else {
        diagramNamespace = id + "#";
      }
    } else {
      diagramNamespace = new Date().toISOString().replace(/\W/g, "");
    }
    this.getNamespacedId = this.getNamespacedIdWithDiagramNamespace(
      diagramNamespace
    );
    this.state = { ...props };
    this.state.latestFilterReferenced = {} as LatestFilterReferenced;
    this.state.latestMarkerReferenced = {} as LatestMarkerReferenced;
  }

  getNamespacedIdWithDiagramNamespace = curry(
    (diagramNamespace: string, id: string): string => {
      return normalizeElementId(diagramNamespace + id);
    }
  );

  getNamespacedFilter: GetNamespacedFilter = filterProps => {
    const { getNamespacedId, filterDrawerMap } = this;
    const { filterName } = filterProps;

    return filterDrawerMap[filterName]({
      getNamespacedId,
      ...filterProps
    });
  };

  // NOTE: it's kind of annoying to have the marker and filter functions all the
  // way up here in the component hierarchy, but we need to have them here,
  // because our SVGs use marker and filter functionality in two different places:
  // the defs and the usage of the defs. Since this is the lowest common ancestor
  // for those two places, we need to define them way up here.
  /*
  getNamespacedFilterId: GetNamespacedFilterId = filterProps => {
    const { filterDrawerMap, getNamespacedId, getNamespacedFilterId } = this;
    const {
      backgroundColor,
      borderWidth,
      color,
      filterName,
      parentBackgroundColor
    } = filterProps;
    const { filterProperties } = filterDrawerMap[filterName]({
      backgroundColor,
      borderWidth,
      color,
      getNamespacedFilterId,
      parentBackgroundColor
    });
    return getNamespacedId(filterProperties.id);
  };
	//*/

  // TODO: delete the commented out function above if possible
  getNamespacedFilterId: GetNamespacedFilterId = latestFilterReferenced => {
    const { getNamespacedFilter } = this;
    const { filterName } = latestFilterReferenced;
    const svgReferenceType = getSVGFilterReferenceType(filterName);

    if (svgReferenceType === "localIRI") {
      // We can only tweak the color, border width, etc. for filters that are
      // located in this SVG (referenced via local IRIs)
      return getNamespacedFilter(latestFilterReferenced).filterProperties.id;
    } else {
      return filterName;
    }
  };

  getNamespacedMarkerId: GetNamespacedMarkerId = latestMarkerReferenced => {
    const { getNamespacedId } = this;
    const {
      markerProperty,
      markerName,
      color,
      parentBackgroundColor
    } = latestMarkerReferenced;

    const svgReferenceType = getSVGMarkerReferenceType(markerName);

    if (svgReferenceType === "localIRI") {
      // We can only tweak the color, border width, etc. for markers that are
      // located in this SVG (referenced via local IRIs)
      return getNamespacedId(
        [markerProperty, markerName, color, parentBackgroundColor].join("")
      );
    } else {
      return markerName;
    }
  };

  getPropsToPassDown = (
    parentProps: Record<string, any>,
    props: Record<string, any>
  ) => {
    let updatedProps;

    const propsToPassDown = pick(
      [
        "edgeDrawerMap",
        "entityMap",
        "getNamespacedFilterId",
        "getNamespacedId",
        "getNamespacedMarkerId",
        "getPropsToPassDown",
        "setFilter",
        "setMarker",
        "type"
      ],
      parentProps
    );

    const inheritedProps = toPairs(props)
      .filter(([key, value]) => value === "inherit")
      .reduce(function(acc, [key, value]) {
        if (!(key in parentProps)) {
          throw new Error(
            `Error: props.${key} equals "inherit", but parentProps.${key} is missing in getPropsToPassDown(${JSON.stringify(
              parentProps
            )}, ${JSON.stringify(props)})`
          );
        }
        acc[key] = parentProps[key];
      }, {});

    updatedProps = assignAll([
      TEXT_CONTENT_DEFAULTS,
      propsToPassDown,
      props,
      inheritedProps
    ]);

    if ("height" in props) {
      updatedProps = defaults(BOX_MODEL_DEFAULTS, updatedProps);
    }

    if ("backgroundColor" in parentProps) {
      const { backgroundColor, parentBackgroundColor } = parentProps;
      const interpolatedBackgroundColor = !("fillOpacity" in parentProps)
        ? backgroundColor
        : interpolate(
            parentBackgroundColor,
            backgroundColor,
            parentProps.fillOpacity
          );
      updatedProps = set(
        "parentBackgroundColor",
        interpolatedBackgroundColor,
        updatedProps
      );
    }
    return updatedProps;
  };

  setFilter = (latestFilterReferenced: LatestFilterReferenced) => {
    this.setState({ latestFilterReferenced });
  };

  setMarker = (latestMarkerReferenced: LatestMarkerReferenced) => {
    this.setState({ latestMarkerReferenced });
  };

  handleClick = e => {
    const { handleClick, entityMap } = this.props;
    const id = e.target.parentNode.parentNode.getAttribute("id");
    const entity = entityMap[id];
    handleClick(
      omitBy((v, k) => k.indexOf("_") === 0, defaults(e, { entity: entity }))
    );
  };

  componentWillReceiveProps(nextProps) {
    let that = this;
    const prevProps = that.props;
    forOwn(function(prop, key) {
      if (key === "filters") {
        that.setState({
          [key]: prop
        });
      } else if (
        prop &&
        JSON.stringify(prevProps[key]) !== JSON.stringify(prop)
      ) {
        that.setState({
          [key]: prop
        });
      }
    }, nextProps);
  }

  render() {
    const {
      getNamespacedFilter,
      getNamespacedFilterId,
      getNamespacedId,
      getNamespacedMarkerId,
      getPropsToPassDown,
      handleClick,
      props,
      state
    } = this;

    const {
      customStyleSVG,
      Icons,
      markerDrawerMap,
      entityMap,
      hiddenEntities,
      highlightedEntities,
      pathway
    } = props;

    const {
      backgroundColor,
      contains,
      height,
      id,
      name,
      textContent,
      width
    } = pathway;

    const drawnEntities = values(entityMap).filter(
      entity => "drawAs" in entity
    );

    const types = drawnEntities.reduce(function(acc, entity) {
      if ("type" in entity) {
        entity.type.forEach(function(typeValue) {
          if (acc.indexOf(typeValue) === -1) {
            acc.push(typeValue);
          }
        });
      }
      return acc;
    }, []);

    const textContentValues = drawnEntities.reduce(
      function(acc, entity) {
        if ("textContent" in entity) {
          const textContent = entity.textContent;
          if (acc.indexOf(textContent) === -1) {
            acc.push(textContent);
          }
        }
        return acc;
      },
      [textContent]
    );

    const highlightedStyle = (highlightedEntities || [])
      .map(function({ target, color }) {
        const namespaceFilterId = getNamespacedFilterId({
          color,
          filterName: "Highlight"
        });
        let selectorPrefix;
        let nodeSelector;
        let edgeSelector;
        if (target in entityMap && "drawAs" in entityMap[target]) {
          selectorPrefix = `#${target}`;
        } else if (types.indexOf(target) > -1) {
          const formattedTarget = formatClassNames(target);
          selectorPrefix = `.${formattedTarget}`;
        } else if (textContentValues.indexOf(target) > -1) {
          selectorPrefix = `[name="${target}"]`;
        } else {
          console.warn(
            `"${target}" does not match the id, type or textContent of any entity. Highlight failed.`
          );
          return;
        }

        nodeSelector = `${selectorPrefix} .Icon`;
        edgeSelector = `${selectorPrefix} path`;

        const fill = interpolate("white", color, 0.5);

        return `
${nodeSelector},${edgeSelector} {
	filter: "url(#${namespaceFilterId})";
}
${nodeSelector} {
	fill: ${fill};
}`;
      })
      .filter(s => !!s)
      .join("\n");

    const pseudoParent = defaultsAll([state, this]);

    // TODO add any prefixes, vocab and base if there is a provided @context
    const prefix = ["schema:http://schema.org/"].join(" ");

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        prefix={prefix}
        id={`${normalizeElementId(id)}-svg`}
        version="1.1"
        baseProfile="full"
        preserveAspectRatio="xMidYMid"
        onClick={handleClick}
        className={formatClassNames("Diagram")}
        typeof="Diagram"
        viewBox={`0 0 ${width} ${height}`}
      >
        <style
          type="text/css"
          dangerouslySetInnerHTML={{
            __html: `
				<![CDATA[
					${kaavioStyleSVG || ""}
					${customStyleSVG || ""}
					${highlightedStyle || ""}
				]]>
			`
          }}
        />

        <defs>
          <FilterDefs
            getNamespacedFilter={getNamespacedFilter}
            latestFilterReferenced={state.latestFilterReferenced}
            {...props}
          />
          <Icons />
          <MarkerDefs
            getNamespacedMarkerId={getNamespacedMarkerId}
            latestMarkerReferenced={state.latestMarkerReferenced}
            markerDrawerMap={markerDrawerMap}
            {...props}
          />
        </defs>

        <Entity
          className="Viewport"
          {...getPropsToPassDown(pseudoParent, pathway)}
        />
      </svg>
    );
  }
}
