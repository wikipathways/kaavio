import * as React from "react";
import * as ReactDom from "react-dom";
import { defaults, defaultsDeep, forOwn, omitBy } from "lodash";
import { values } from "lodash/fp";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/dom/ajax";
import "rxjs/add/observable/from";
import "rxjs/add/observable/of";
import "rxjs/add/operator/do";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import { style, getStyles } from "typestyle";
import { Group } from "./Group";
import { FilterDefs } from "./Filter/FilterDefs";
import { MarkerDefs } from "./Marker/MarkerDefs";
import * as kaavioStyle from "../kaavio.style";
import * as filterDrawers from "../drawers/filters/__bundled_dont_edit__";
import * as customStyle from "../drawers/styles/__bundled_dont_edit__";
import { Icons } from "../drawers/icons/__bundled_dont_edit__";

export class Diagram extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { ...props };
    this.state.iconSuffix = new Date().toISOString().replace(/\W/g, "");
    this.state.latestMarkerReferenced = {};
    this.state.latestFilterReferenced = {};
  }

  getFilterId = latestFilterReferenced => {
    this.setState({ latestFilterReferenced: latestFilterReferenced });
    const { filterName } = latestFilterReferenced;
    const { filterProperties } = filterDrawers[filterName](
      latestFilterReferenced
    );
    return filterProperties.id;
  };

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
      backgroundColor,
      entityMap,
      filters,
      height,
      hiddenEntities,
      highlightedEntities,
      id,
      name,
      pathway,
      width
    } = this.props;
    const { contains } = pathway;

    const mergedStyle: Record<string, any> = defaultsDeep(
      customStyle,
      kaavioStyle
    );
    style(mergedStyle);

    const drawnEntities = values(entityMap).filter(entity =>
      entity.hasOwnProperty("drawAs")
    );

    const drawnValueTypes = drawnEntities.reduce(function(acc, entity) {
      if (entity.hasOwnProperty("type")) {
        entity.type.forEach(function(typeValue) {
          if (acc.indexOf(typeValue) === -1) {
            acc.push(typeValue);
          }
        });
      }
      return acc;
    }, []);

    const highlightedStyle = (highlightedEntities || [])
      .map(function({ target, color }) {
        const { filterProperties } = filterDrawers.Highlight({
          color
        });
        const filterId = filterProperties.id;
        let selector;
        if (
          entityMap.hasOwnProperty(target) &&
          entityMap[target].hasOwnProperty("drawAs")
        ) {
          selector = `#${target} .Icon,#${target} path`;
        } else if (drawnValueTypes.indexOf(target) > -1) {
          selector = `[typeof~="${target}"] .Icon,[typeof~="${target}"] path`;
        } else {
          console.warn(
            `"${target}" is neither an id nor a type. Failed to highlight it.`
          );
          return;
        }
        return `${selector} {filter: url(#${filterId});}`;
      })
      .filter(s => !!s)
      .join("\n");

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
					${highlightedStyle}
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
            <FilterDefs
              latestFilterReferenced={this.state.latestFilterReferenced}
              {...this.props}
            />
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
            entityMap={entityMap}
            mergedStyle={mergedStyle}
            getFilterId={this.getFilterId}
            defineMarker={this.defineMarker}
            {...pathway}
          />
        </g>
      </svg>
    );
  }
}
