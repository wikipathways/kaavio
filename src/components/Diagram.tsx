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
import {
  classNamesToArray,
  classNamesToString
} from "../utils/formatClassNames";
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

function normalizeTargetValue(targetValue) {
  return targetValue.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export class Diagram extends React.Component<any, any> {
  getNamespacedId: GetNamespacedId;

  constructor(props) {
    super(props);
    const { entitiesById, pathway, theme, opacities, highlights } = props;

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

    const drawnEntities = values(entitiesById).filter(
      entity => "drawAs" in entity
    );

    drawnEntities.forEach(function(drawnEntity) {
      if ("type" in drawnEntity) {
        drawnEntity.classNames = classNamesToArray(
          reduce(
            function(acc, typeItem): any {
              if (typeItem in entitiesById) {
                const { id, exactMatch, closeMatch, sameAs } = entitiesById[
                  typeItem
                ];
                return unionLSV(
                  acc,
                  typeItem,
                  id,
                  exactMatch,
                  closeMatch,
                  sameAs
                );
              } else {
                return unionLSV(acc, typeItem);
              }
            },
            unionLSV(
              drawnEntity.className,
              drawnEntity.classNames,
              drawnEntity.kaavioType
            ),
            drawnEntity.type
          )
        );
      }
    });

    const classNamesByNormalized = drawnEntities.reduce(function(acc, entity) {
      if ("classNames" in entity) {
        entity.classNames.forEach(function(classNameValue) {
          const normalized = normalizeTargetValue(classNameValue);
          if (!(normalized in acc)) {
            acc[normalized] = [];
          }
          if (acc[normalized].indexOf(classNameValue) === -1) {
            acc[normalized].push(classNameValue);
          }
        });
      }
      return acc;
    }, {});

    const textContentValuesByNormalized = drawnEntities.reduce(function(
      acc,
      entity
    ) {
      if ("textContent" in entity) {
        const textContentValue = entity.textContent;
        const normalized = normalizeTargetValue(textContentValue);
        if (!(normalized in acc)) {
          acc[normalized] = [];
        }
        if (acc[normalized].indexOf(textContentValue) === -1) {
          acc[normalized].push(textContentValue);
        }
      }
      return acc;
    },
    {});

    const diagramStyleForOpacities = (opacities || [])
      .map(function([targetKey, targetValue, styleValue]) {
        const opacity = styleValue;
        let targetValues;
        if (!targetKey) {
          const normalized = normalizeTargetValue(targetValue);
          if (
            targetValue in entitiesById &&
            "drawAs" in entitiesById[targetValue]
          ) {
            targetKey = "id";
          } else if (
            normalized in classNamesByNormalized ||
            normalized in textContentValuesByNormalized
          ) {
            //ReactDOM.Element.proto
            let originals;
            if (normalized in classNamesByNormalized) {
              targetKey = "class";
              originals = classNamesByNormalized[normalized];
            } else {
              targetKey = "name";
              originals = textContentValuesByNormalized[normalized];
            }

            if (targetValue in originals) {
              targetValues = [targetValue];
            } else {
              targetValues = originals;
              if (originals.length > 1) {
                console.warn(
                  `Warning: ${targetValue} maps to multiple: ${originals.join()}`
                );
              }
            }
          } else {
            console.warn(
              `"${targetValue}" does not match the id, class/type or textContent of any entity. Hide failed.`
            );
            return;
          }
        } else {
          targetValues = [targetValue];
        }

        let selectorPrefixes = [];
        if (targetKey === "id") {
          selectorPrefixes = [`#${targetValue}`];
        } else if (targetKey === "class") {
          selectorPrefixes = targetValues.map(
            targetValue => `.${classNamesToArray(targetValue)}`
          );
        } else if (targetKey === "name") {
          selectorPrefixes = targetValues.map(
            targetValue => `[name="${targetValue}"]`
          );
        }

        const nodeSelector = selectorPrefixes
          .map(selectorPrefix => `${selectorPrefix}`)
          .join(",");
        const edgeSelector = selectorPrefixes
          .map(selectorPrefix => `${selectorPrefix}`)
          .join(",");

        return `
${nodeSelector} {
	opacity: ${opacity};
}
${edgeSelector} {
	opacity: ${opacity};
}`;
      })
      .filter(s => !!s)
      .join("\n");

    const diagramStyleForHighlighted = (highlights || [])
      .map(function([targetKey, targetValue, styleValue]) {
        const color = styleValue;
        const filterReference = getFilterReference({
          color,
          filterName: "Highlight"
        });
        let targetValues;
        if (!targetKey) {
          const normalized = normalizeTargetValue(targetValue);
          if (
            targetValue in entitiesById &&
            "drawAs" in entitiesById[targetValue]
          ) {
            targetKey = "id";
          } else if (
            normalized in classNamesByNormalized ||
            normalized in textContentValuesByNormalized
          ) {
            //ReactDOM.Element.proto
            let originals;
            if (normalized in classNamesByNormalized) {
              targetKey = "class";
              originals = classNamesByNormalized[normalized];
            } else {
              targetKey = "name";
              originals = textContentValuesByNormalized[normalized];
            }

            if (targetValue in originals) {
              targetValues = [targetValue];
            } else {
              targetValues = originals;
              if (originals.length > 1) {
                console.warn(
                  `Warning: ${targetValue} maps to multiple: ${originals.join()}`
                );
              }
            }
          } else {
            console.warn(
              `"${targetValue}" does not match the id, class/type or textContent of any entity. Highlight failed.`
            );
            return;
          }
        } else {
          targetValues = [targetValue];
        }

        let selectorPrefixes = [];
        if (targetKey === "id") {
          selectorPrefixes = [`#${targetValue}`];
        } else if (targetKey === "class") {
          selectorPrefixes = targetValues.map(
            targetValue => `.${classNamesToArray(targetValue)}`
          );
        } else if (targetKey === "name") {
          selectorPrefixes = targetValues.map(
            targetValue => `[name="${targetValue}"]`
          );
        }

        const nodeSelector = selectorPrefixes
          .map(selectorPrefix => `${selectorPrefix} > .Icon`)
          .join(",");
        const nodeTextSelector = selectorPrefixes
          .map(selectorPrefix => `${selectorPrefix} > .Text`)
          .join(",");
        const edgeSelector = selectorPrefixes
          .map(selectorPrefix => `${selectorPrefix} > path`)
          .join(",");

        const highlighterFill = color;
        /*
        const highlighterFill = interpolate(
          foreground(foreground(pathway.fill)),
          color,
          0.75
        );
        //*/

        // change font color to contrast with highlighted color
        const highlightedFontColor = foreground(highlighterFill);

        return `
${nodeSelector} {
	fill: ${highlighterFill};
	filter: ${filterReference};
}
${nodeTextSelector} {
	fill: ${highlightedFontColor};
}
${edgeSelector} {
	filter: ${filterReference};
}`;
      })
      .filter(s => !!s)
      .join("\n");

    this.state = {
      diagramStyleForOpacities,
      diagramStyleForHighlighted,
      ...{ highlights: [], opacities: [] },
      ...this.setFillOpacity(props)
    };
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
        .reduce(function(acc, [key, value]): void | Record<string, any> {
          if (!(key in parentProps)) {
            throw new Error(
              `Error: props.${key} equals "inherit", but parentProps.${key} is missing in createChildProps(${JSON.stringify(
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
    const id = e.target.parentNode.getAttribute("id");
    const entity = entitiesById[id];
    handleClick(
      omitBy((v, k) => k.indexOf("_") === 0, defaults(e, { entity: entity }))
    );
  };

  componentWillReceiveProps(nextProps) {
    let that = this;
    const prevProps = that.props;

    const changedProps = fromPairs(
      toPairs(nextProps).filter(function([key, nextProp]) {
        return prevProps[key] !== nextProp;
      })
    );
    if (!isEmpty(changedProps)) {
      that.setState(this.setFillOpacity(changedProps));
    }
  }

  render() {
    const { getNamespacedId, createChildProps3, handleClick, state } = this;

    const {
      diagramStyleForOpacities,
      diagramStyleForHighlighted,
      entitiesById,
      opacities,
      highlights,
      pathway,
      theme
    } = state;

    const createChildProps = createChildProps3(entitiesById);

    const { Defs, diagramStyle: diagramStyleCustom } = theme;

    const { fill, contains, height, id, name, width } = pathway;

    const pseudoParent = defaultsAll([
      state,
      this,
      {
        createChildProps
      }
    ]);

    const foregroundColor = foreground(fill);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        id={`${normalizeElementId(id)}-svg`}
        version="1.1"
        baseProfile="full"
        preserveAspectRatio="xMidYMid"
        color={foregroundColor}
        onClick={handleClick}
        className={classNamesToString("Diagram")}
        viewBox={`0 0 ${width} ${height}`}
      >
        <style
          type="text/css"
          dangerouslySetInnerHTML={{
            __html: `
<![CDATA[
	.Viewport .Text, .Viewport .Text * {
	  pointer-events: none;
	}

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
	${diagramStyleForOpacities || ""}
]]>
`
          }}
        />

        <defs>
          <FilterDefs {...{ entitiesById, highlights, pathway }} />
          <Defs />
        </defs>

        <Entity
          {...createChildProps(pseudoParent, {
            classNames: "Viewport",
            ...pathway
          })}
        />
      </svg>
    );
  }
}
