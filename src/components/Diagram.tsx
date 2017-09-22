import "source-map-support/register";
import * as React from "react";
import * as ReactDom from "react-dom";
import { defaults, defaultsDeep, forOwn, omitBy } from "lodash";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/dom/ajax";
import "rxjs/add/observable/from";
import "rxjs/add/observable/of";
import "rxjs/add/operator/do";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import { style, getStyles } from "typestyle";
import { MarkerDefs } from "./Marker/MarkerDefs";
import * as kaavioStyle from "../kaavio.style";
import { Icons } from "../drawers/icons/__bundled_dont_edit__";
import { Group } from "./Group";

export class Diagram extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { ...props };
    this.state.iconSuffix = new Date().toISOString().replace(/\W/g, "");
    this.state.latestMarkerReferenced = {};
  }

  defineMarker = latestMarkerReferenced => {
    this.setState({ latestMarkerReferenced: latestMarkerReferenced });
  };

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
            <MarkerDefs
              latestMarkerReferenced={this.state.latestMarkerReferenced}
              {...this.props}
            />
          </defs>

          <Group
            drawAs="rectangle"
            x="0"
            y="0"
            className="kaavio-viewport-background"
            borderWidth="0"
            parentBackgroundColor={backgroundColor}
            fillOpacity={1}
            highlightedNodes={highlightedNodes}
            entityMap={entityMap}
            hiddenEntities={hiddenEntities}
            mergedStyle={mergedStyle}
            defineMarker={this.defineMarker}
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
