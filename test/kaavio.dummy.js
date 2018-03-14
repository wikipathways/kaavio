import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioEl } from "../esnext/Kaavio";
import * as theme from "./dummy-themes/silly/theme";
export class Kaavio {
  constructor(
    containerSelectorOrEl,
    {
      diagramStyle = "silly",
      hidden = [],
      highlighted = [],
      pathway = {},
      entitiesById = {},
      hydrate = false
    }
  ) {
    this._containerEl = isString(containerSelectorOrEl)
      ? document.querySelector(containerSelectorOrEl)
      : containerSelectorOrEl;
    this._diagramStyle = diagramStyle;
    this._hidden = hidden;
    this._highlighted = highlighted;
    this._pathway = pathway;
    this._entitiesById = entitiesById;
    this._renderMethod = hydrate ? "hydrate" : "render";
    this.render();
  }
  set diagramStyle(diagramStyle) {
    this._diagramStyle = diagramStyle;
    this.render();
  }
  set hidden(hidden) {
    this._hidden = hidden;
    this.render();
  }
  set highlighted(highlighted) {
    this._highlighted = highlighted;
    this.render();
  }
  set pathway(pathway) {
    const {
      _containerEl,
      _diagramStyle,
      _hidden,
      _highlighted,
      _pathway
    } = this;
    this._pathway = pathway;
    ReactDOM.unmountComponentAtNode(_containerEl);
    this.render();
  }
  set entitiesById(entitiesById) {
    const {
      _containerEl,
      _diagramStyle,
      _hidden,
      _highlighted,
      _entitiesById
    } = this;
    this._entitiesById = entitiesById;
    ReactDOM.unmountComponentAtNode(_containerEl);
    this.render();
  }
  render() {
    const {
      _containerEl,
      _diagramStyle,
      _hidden,
      _highlighted,
      _pathway,
      _entitiesById,
      _renderMethod
    } = this;
    //theme: { containerStyle: "", diagramStyle: "", edges },
    return ReactDOM[_renderMethod](
      React.createElement(
        KaavioEl,
        Object.assign(
          {},
          {
            onEntityClick: function(e) {
              console.log("onEntityClick");
              console.log(e);
            },
            theme,
            hidden: _hidden,
            highlighted: _highlighted,
            pathway: _pathway,
            entitiesById: _entitiesById
          }
        )
      ),
      _containerEl
    );
  }
}
