import { filter, isEmpty, omit, partition, reduce, toPairs } from "lodash/fp";
import * as React from "react";
import { Validator } from "collit";

import { Diagram } from "./components/Diagram";
import { PanZoom } from "./components/PanZoom";

const containerStyleBase = `
.UserSpecifiedContainer {
  font-family: "Roboto";
  position: "relative";
  width: "100%";
  height: "100%";
  /* To avoid covering up the resize handle (grab area) */
  border-bottom-right-radius: 1em 1em;
  overflow: hidden;
}

.Container {
  width: inherit;
  height: inherit;
  /* To avoid covering up the resize handle (grab area) */
  border-bottom-right-radius: inherit;
  overflow: inherit;
}

/* this is the svg */
.Diagram {
  width: inherit;
  height: inherit;
  overflow: inherit;
  color-interpolation: auto;
  image-rendering: auto;
  shape-rendering: auto;
  vector-effect: non-scaling-stroke;
}`;

/**
 * Kaavio component.
 * This is the highest component in Kaavio. All states are handled here and passed down as props to other components.
 *
 * You may pass an onReady(kaavio) function to this. This will be called with the Kaavio reference when everything is
 * rendered. You can access the manipulation API via kaavio.manipulator
 */
export class Kaavio extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const { theme, hidden, highlighted } = this.props;
    const { containerStyle: containerStyleCustom } = theme;

    const searchParams = new URLSearchParams(location.search);

    // TODO reconcile query params and class props for pan/zoom settings

    let reconciledHiddenEntities;
    const hideParam = searchParams.get("hide");
    if (!isEmpty(hidden)) {
      reconciledHiddenEntities = hidden;
      if (!isEmpty(hideParam)) {
        console.warn(`Warning: "hidden" was specified by two different sources, which may or may not conflict.
		prop passed to Kaavio class:
			hidden={${JSON.stringify(hidden)}}
		URL query param:
			hide=${hideParam}
		Setting URL query params to match prop passed to Kaavio class.`);

        const searchParams = new URLSearchParams(location.search);
        searchParams.set("hide", hidden.join());

        history.replaceState(
          { hidden: hidden },
          document.title,
          "?" + searchParams.toString()
        );
      }
    } else if (!isEmpty(hideParam)) {
      reconciledHiddenEntities = hideParam.split(",").map(decodeURIComponent);
    }

    let reconciledHighlightedEntities;
    const [highlightParams, nonHighlightParams] = partition(function(
      [key, value]
    ) {
      return Validator.isColor(key);
    }, Array.from(searchParams));

    if (!isEmpty(highlighted)) {
      reconciledHighlightedEntities = highlighted;

      if (!isEmpty(highlightParams)) {
        console.warn(`Warning: "highlighted" was specified by two different sources, which may or may not conflict.
		prop passed to Kaavio class:
			highlighted={${JSON.stringify(highlighted)}}
		URL query params:
			${JSON.stringify(highlightParams)}
		Setting URL query params to match prop passed to Kaavio class.`);

        const updatedParams = new URLSearchParams();
        [
          ...nonHighlightParams,
          ...toPairs(
            reduce(
              function(acc, { target, color }) {
                acc[color] = acc[color] || [];
                acc[color].push(target);
                return acc;
              },
              {},
              highlighted
            )
          ).map(function([color, targets]) {
            return [color, targets.join()];
          })
        ].forEach(function([name, value]) {
          updatedParams.set(name, value);
        });

        history.replaceState(
          { highlighted: highlighted },
          document.title,
          "?" + updatedParams.toString()
        );
      }
    } else if (!isEmpty(highlightParams)) {
      reconciledHighlightedEntities = toPairs(
        highlightParams.reduce(function(acc, [color, targetString]) {
          targetString
            .split(",")
            .map(decodeURIComponent)
            .forEach(function(target) {
              if (!acc.hasOwnProperty(target)) {
                acc[target] = color;
              }
            });
          return acc;
        }, {})
      ).map(function([target, color]) {
        return { target, color };
      });
    }

    // TODO don't just keep adding!
    this.addStyle([containerStyleBase, containerStyleCustom]);

    this.state = {
      diagramRef: null,
      hidden: reconciledHiddenEntities,
      highlighted: reconciledHighlightedEntities
    };
  }

  addStyle = (styles: string[]) => {
    var styleEl = document.createElement("style");
    styleEl.innerHTML = styles.join("\n");
    // Append style element to head
    document.head.appendChild(styleEl);
  };

  onPanZoomReady = panZoom => {
    // Fire the onReady function with a reference to Kaavio
    const { onReady } = this.props;
    !!onReady && onReady(this);
  };

  handleClick = e => {
    const { onEntityClick } = this.props;
    const entity = e.entity;
    if (onEntityClick && entity) onEntityClick(entity);
  };

  render() {
    const {
      entitiesById,
      pathway,
      zoomedEntities,
      pannedEntities,
      zoomLevel,
      panCoordinates,
      onPanZoomChange,
      theme,
      showPanZoomControls = true,
      panZoomLocked = false
    } = this.props;

    const {
      highlighted,
      hidden
      /*
      zoomedEntities,
      pannedEntities,
      zoomLevel,
      panCoordinates,
      showPanZoomControls = true,
      panZoomLocked = false
			//*/
    } = this.state;

    // TODO: Don't use refs!
    // Accessing the diagram ref from the state is a little bit of a hack to get panZoom working.
    // Consider refactoring the panZoom to be truly Reactive and not use refs
    return (
      <div id={`kaavio-container-for-${pathway.id}`} className="Container">
        <Diagram
          ref={diagram =>
            !this.state.diagramRef && this.setState({ diagramRef: diagram })}
          entitiesById={entitiesById}
          hidden={hidden}
          highlighted={highlighted}
          pathway={pathway}
          handleClick={this.handleClick}
          theme={omit("containerStyle", theme)}
        />
        <PanZoom
          diagram={this.state.diagramRef}
          zoomLevel={zoomLevel}
          panCoordinates={panCoordinates}
          zoomedEntities={zoomedEntities}
          pannedEntities={pannedEntities}
          onChange={onPanZoomChange}
          locked={panZoomLocked}
          onReady={this.onPanZoomReady}
          showPanZoomControls={showPanZoomControls}
        />
      </div>
    );
  }
}
