import "source-map-support/register";
import * as React from "react";
import * as ReactDom from "react-dom";
import {
  defaults,
  defaultsDeep,
  intersection,
  keys,
  forOwn,
  omitBy,
  toPairs,
  values
} from "lodash";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/dom/ajax";
import "rxjs/add/observable/from";
import "rxjs/add/observable/of";
import "rxjs/add/operator/do";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import { style, getStyles } from "typestyle";
import {
  MARKER_PROPERTY_NAMES,
  NON_FUNC_IRI_MARKER_PROPERTY_VALUES
} from "./Marker";
import { getMarkerId, Marker } from "./Marker";
import * as kaavioStyle from "../kaavio.style";
import { normalizeElementId } from "../utils/normalizeElementId";
import { Icons } from "../drawers/icons/__bundled_dont_edit__";
import * as markerDrawers from "../drawers/markers/__bundled_dont_edit__";
import * as edgeDrawers from "../drawers/edges/__bundled_dont_edit__";
import { Group } from "./Group";

export class Diagram extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { ...props };
    this.state.iconSuffix = new Date().toISOString().replace(/\W/g, "");
  }

  handleClick(e) {
    const { handleClick, entityMap } = this.props;
    const id = e.target.parentNode.parentNode.getAttribute("id");
    const entity = entityMap[id];
    handleClick(
      omitBy(defaults({ entity: entity }, e), (v, k) => k.indexOf("_") === 0)
    );
  }

  componentWillReceiveProps(nextProps) {
    let that = this;
    const prevProps = that.props;
    forOwn(nextProps, function(prop, key) {
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
    });
  }

  getMarkerInputs(edges) {
    const markerColors = Array.from(
      edges
        .filter(edge => edge.hasOwnProperty("color"))
        .reduce(function(acc, edge) {
          acc.add(edge.color);
          return acc;
        }, new Set())
    );

    const markerBackgroundColors = Array.from(
      edges
        .filter(edge => edge.hasOwnProperty("backgroundColor"))
        .reduce(function(acc, edge) {
          acc.add(edge.backgroundColor);
          return acc;
        }, new Set())
    );

    const markerNames = Array.from(
      edges.reduce(function(acc, edge: any) {
        intersection(MARKER_PROPERTY_NAMES, keys(edge))
          .map((markerLocationType: string): string =>
            normalizeElementId(edge[markerLocationType])
          )
          // We don't want to create marker defs for markers when
          // it has an SVG-standard non-functional name, such as "none".
          .filter(
            (markerName: string & NonFuncIriMarkerPropertyValue) =>
              NON_FUNC_IRI_MARKER_PROPERTY_VALUES.indexOf(markerName) === -1
          )
          .forEach(function(markerName) {
            if (markerDrawers.hasOwnProperty(markerName)) {
              acc.add(markerName);
            } else {
              // Can't draw it if we don't have a markerDrawer for it.
              console.warn(`Missing markerDrawer for "${markerName}"`);
            }
          });
        return acc;
      }, new Set())
    );

    return markerColors
      .map(color => ({ color: color }))
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          markerBackgroundColors.map(function(markerBackgroundColor) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerBackgroundColor = markerBackgroundColor;
              return subAcc;
            }, {});
          })
        );
      }, [])
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          MARKER_PROPERTY_NAMES.map(function(markerLocationType) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerLocationType = markerLocationType;
              return subAcc;
            }, {});
          })
        );
      }, [])
      .reduce(function(acc: any[], partialInput) {
        const pairs = toPairs(partialInput);
        return acc.concat(
          markerNames.map(function(markerName) {
            return pairs.reduce(function(subAcc: any, pair) {
              const key = pair[0];
              subAcc[key] = pair[1];
              subAcc.markerName = markerName;
              return subAcc;
            }, {});
          })
        );
      }, []) as any[];
  }

  render() {
    const {
      id,
      backgroundColor,
      customStyle,
      entityMap,
      filters,
      height,
      name,
      pathway,
      width,
      zIndices,
      highlightedNodes,
      hiddenEntities
    } = this.props;
    const { contains } = pathway;

    const zIndexedEntities = contains.map(id => entityMap[id]);

    const markerInputs = this.getMarkerInputs(
      values(entityMap).filter(
        (x: Record<string, any>) => x.kaavioType === "Edge"
      )
    );
    const mergedStyle: Record<string, any> = defaultsDeep(
      customStyle,
      kaavioStyle
    );
    style(mergedStyle);

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        id={id}
        version="1.1"
        baseProfile="full"
        preserveAspectRatio="xMidYMid"
        onClick={this.handleClick.bind(this)}
        className={`kaavio-diagram ${mergedStyle.diagramClass}`}
        viewBox={`0 0 ${width} ${height}`}
      >

        <style
          type="text/css"
          dangerouslySetInnerHTML={{
            __html: `
				<![CDATA[
					${getStyles()}
				]]>
			`
          }}
        />

        <g
          className={`viewport ${mergedStyle.viewportClass} svg-pan-zoom_viewport`}
        >

          <defs>
            {
              <clipPath
                id="rounded-rectangle-clip-path"
                clipPathUnits="objectBoundingBox"
              >
                <rect x="0" y="0" rx="0.125" ry="0.25" width="1" height="1" />
              </clipPath>
            }
            {filters}
            <Icons />

            {markerInputs.map(input => {
              const {
                markerLocationType,
                markerName,
                color,
                markerBackgroundColor
              } = input;
              const normalizedName = normalizeElementId(markerName);
              return (
                <Marker
                  key={getMarkerId(
                    markerLocationType,
                    markerName,
                    color,
                    markerBackgroundColor
                  )}
                  color={color}
                  backgroundColor={markerBackgroundColor}
                  normalizedName={normalizedName}
                  markerLocationType={markerLocationType}
                  markerDrawer={markerDrawers[normalizedName]}
                />
              );
            })}
          </defs>

          <Group
            drawAs="rectangle"
            x="0"
            y="0"
            className="kaavio-viewport-background"
            borderWidth="0"
            highlightedNodes={highlightedNodes}
            entityMap={entityMap}
            hiddenEntities={hiddenEntities}
            edgeDrawers={edgeDrawers}
            mergedStyle={mergedStyle}
            {...pathway}
          />
          {/*
import { getHighlighted } from "../utils/getHighlighted";
import { getHidden } from "../utils/getHidden";
import { Entity } from "./Entity";
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            className="kaavio-viewport-background"
            fill={backgroundColor}
          />
          <g width={width} height={height}>
            {zIndexedEntities.map(function(entity) {
              const highlighted = getHighlighted(entity, highlightedNodes);
              const hidden = getHidden(entity, hiddenEntities);
              return (
                <Entity
                  key={entity.id}
                  isHighlighted={highlighted.highlighted}
                  highlightedColor={highlighted.color}
                  highlightedNodes={highlightedNodes}
                  entityMap={entityMap}
                  hidden={hidden}
                  hiddenEntities={hiddenEntities}
                  edgeDrawers={edgeDrawers}
                  mergedStyle={mergedStyle}
                  {...entity}
                />
              );
            })}
          </g>
						
						*/}
        </g>
      </svg>
    );
  }
}
