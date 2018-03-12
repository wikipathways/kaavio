import { foreground, isValidColor } from "../spinoffs/wcag-contrast";
import * as React from "react";
import * as ReactDom from "react-dom";
import {
  assign,
  assignAll,
  curry,
  defaults,
  defaultsAll,
  filter,
  fromPairs,
  forOwn,
  isArray,
  isBoolean,
  isEmpty,
  isFinite,
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
import { unionLSV } from "../spinoffs/jsonld-utils";
import { formatClassNames } from "../utils/formatClassNames";
import { GetNamespacedId } from "../types";
import { Entity } from "./Entity";
import { FilterDefs, getFilterReference } from "./Filter/FilterDefs";
import { interpolate } from "../spinoffs/interpolate";
import { normalizeElementId } from "../utils/normalizeElementId";

// TODO what is the best way to handle CSS when using tsc?
// Compiling w/ webpack is really slow for the CLI.
//const diagramStyleBase = require("./Diagram.css");
//${diagramStyleBase || ""}

const BOX_MODEL_DEFAULTS = {
  padding: 0, // px
  verticalAlign: "top"
};
const TEXT_CONTENT_DEFAULTS = {
  fill: "#141414",
  fontFamily: "arial",
  fontSize: 12, // px
  lineHeight: 1.5, // unitless
  textAlign: "start",
  whiteSpace: "pre"
};

export class Diagram extends React.Component<any, any> {
  getNamespacedId: GetNamespacedId;

  constructor(props) {
    super(props);
    const { entitiesById, pathway, theme } = props;

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
    this.state = { ...this.setFillOpacity(props) };
  }

  public setFillOpacity = props => {
    const { fill, fillOpacity } = props;
    if (fill === "transparent") {
      props.fillOpacity = 0;
    } else if (isFinite(fillOpacity)) {
      props.fillOpacity = fillOpacity;
    }
    return props;
  };

  getNamespacedIdWithDiagramNamespace = curry(
    (diagramNamespace: string, id: string): string => {
      return normalizeElementId(diagramNamespace + id);
    }
  );

  createChildProps3 = curry(
    (
      entitiesById: Record<string, any>,
      parentProps: Record<string, any>,
      props: Record<string, any>
    ) => {
      let updatedProps;

      const propsToPassDown = pick(
        [
          "createChildProps",
          "Defs",
          "entitiesById",
          "getNamespacedId",
          "setFillOpacity",
          "theme",
          "type"
        ],
        parentProps
      );

      const inheritedProps = toPairs(props)
        .filter(([key, value]) => value === "inherit")
        .reduce(function(acc, [key, value]) {
          if (!(key in parentProps)) {
            throw new Error(
              `Error: props.${key} equals "inherit", but parentProps.${key} is missing in createChildProps(${JSON.stringify(
                parentProps
              )}, ${JSON.stringify(props)})`
            );
          }
          acc[key] = parentProps[key];
        }, {});

      const updatedType = reduce(
        function(acc, typeItem) {
          let moreTypes;
          if (typeItem in entitiesById) {
            const { id, exactMatch, closeMatch, sameAs } = entitiesById[
              typeItem
            ];
            return unionLSV(acc, typeItem, id, exactMatch, closeMatch, sameAs);
          } else {
            return unionLSV(acc, typeItem);
          }
        },
        [],
        props.type
      );

      // type (for typeof) will include any available synonyms;
      // className (for class) will not.
      updatedProps = assignAll([
        TEXT_CONTENT_DEFAULTS,
        propsToPassDown,
        props,
        inheritedProps,
        {
          className: unionLSV(props.className, props.type, props.kaavioType),
          type: updatedType
        }
      ]);

      updatedProps = propsToPassDown.setFillOpacity(updatedProps);

      // TODO could we use these as markers? http://graphemica.com/blocks/arrows

      if ("height" in props) {
        updatedProps = defaults(BOX_MODEL_DEFAULTS, updatedProps);
      }

      if ("fill" in parentProps) {
        const { fill, parentFill } = parentProps;
        let interpolatedFill;
        if (!isValidColor(fill)) {
          interpolatedFill = parentFill;
        } else if (!("fillOpacity" in parentProps)) {
          interpolatedFill = fill;
        } else {
          interpolatedFill = interpolate(
            parentFill,
            fill,
            parentProps.fillOpacity
          );
        }
        updatedProps = set("parentFill", interpolatedFill, updatedProps);
      }
      return updatedProps;
    }
  );

  handleClick = e => {
    const { handleClick, entitiesById } = this.props;
    const id = e.target.parentNode.parentNode.getAttribute("id");
    const entity = entitiesById[id];
    handleClick(
      omitBy((v, k) => k.indexOf("_") === 0, defaults(e, { entity: entity }))
    );
  };

  componentWillReceiveProps(nextPropsRaw) {
    let that = this;
    const prevProps = that.props;

    const nextProps = this.setFillOpacity(nextPropsRaw);

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
    const { getNamespacedId, createChildProps3, handleClick, state } = this;

    const { entitiesById, hidden, highlighted, pathway, theme } = state;

    const createChildProps = createChildProps3(entitiesById);

    const { Defs, diagramStyle: diagramStyleCustom } = theme;

    const { fill, contains, height, id, name, textContent, width } = pathway;

    const drawnEntities = values(entitiesById).filter(
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

    const diagramStyleForHighlighted = (highlighted || [])
      .map(function({ target, color }) {
        const filterReference = getFilterReference({
          color,
          filterName: "Highlight"
        });
        let selectorPrefix;
        let nodeSelector;
        let edgeSelector;
        if (target in entitiesById && "drawAs" in entitiesById[target]) {
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

        const highlighterFill = interpolate(fill, color, 0.5);

        return `
${nodeSelector},${edgeSelector} {
	filter: ${filterReference};
}
${nodeSelector} {
	fill: ${highlighterFill};
}`;
      })
      .filter(s => !!s)
      .join("\n");

    const pseudoParent = defaultsAll([
      state,
      this,
      {
        createChildProps,
        kaavioType: "Viewport"
      }
    ]);

    // TODO add any prefixes, vocab and base if there is a provided @context
    const prefix = ["schema:http://schema.org/"].join(" ");

    const foregroundColor = foreground(fill);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        prefix={prefix}
        id={`${normalizeElementId(id)}-svg`}
        version="1.1"
        baseProfile="full"
        preserveAspectRatio="xMidYMid"
        color={foregroundColor}
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
	.Viewport .Text > tspan {
	  /*all: inherit;*/
	  direction: inherit;
	  dominant-baseline: inherit;
	  fill: inherit;
	  font-family: inherit;
	  font-size: inherit;
	  font-style: inherit;
	  font-weight: inherit;
	  overflow: inherit;
	  pointer-events: none;
	  stroke: inherit;
	  stroke-width: inherit;
	  text-anchor: inherit;
	}

	marker {
	  /* this is what should work per the spec
	  stroke-dasharray: none; */
	  /* but I need to add this to make it work in Safari */
	  stroke-dasharray: 9999999999999999999999999;
	}
	${diagramStyleCustom || ""}
	${diagramStyleForHighlighted || ""}
]]>
			`
          }}
        />

        <defs>
          <FilterDefs {...state} />
          <Defs />
        </defs>

        <Entity
          className="Viewport"
          {...createChildProps(pseudoParent, pathway)}
        />
      </svg>
    );
  }
}
