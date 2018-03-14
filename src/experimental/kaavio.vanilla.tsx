import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioEl } from "./Kaavio";
//import * as edges from "./drawers/edges/index";
//import * as theme from "../test/dummy-themes/silly/theme";
//import * as theme from "./dummy-themes/silly/theme";

export type Pathway = Record<string, any>;
export type EntitiesById = Record<string, any>;

export class Kaavio {
  // NOTE: this is the user-specified container, not the Kaavio container
  private _containerEl: any;
  private _diagramStyle: string;
  private _hidden: any[];
  private _highlighted: any[];
  private _pathway: Record<string, any>;
  private _entitiesById: Record<string, any>;
  private _renderMethod: "hydrate" | "render";
  constructor(
    containerSelectorOrEl: any,
    {
      diagramStyle = "plain",
      hidden = [],
      highlighted = [],
      pathway = {} as Pathway,
      entitiesById = {} as EntitiesById,
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

  set diagramStyle(diagramStyle: string) {
    this._diagramStyle = diagramStyle;
    this.render();
  }

  set hidden(hidden: any[]) {
    this._hidden = hidden;
    this.render();
  }

  set highlighted(highlighted: any[]) {
    this._highlighted = highlighted;
    this.render();
  }

  set pathway(pathway: Pathway) {
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

  set entitiesById(entitiesById: EntitiesById) {
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
      <KaavioEl
        {...{
          theme: {},
          hidden: _hidden,
          highlighted: _highlighted,
          pathway: _pathway,
          entitiesById: _entitiesById
        }}
      />,
      _containerEl
    );
  }
}

/*
import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioReactEl } from "./Kaavio";

import * as edges from "./drawers/edges/index";

export class Kaavio {
	constructor(userSpecifiedContainerInput: any, data) {
		const userSpecifiedContainer = isString(userSpecifiedContainerInput)
			? document.querySelector(userSpecifiedContainerInput)
			: userSpecifiedContainerInput;

	}

	render() {
		ReactDOM.render(
			<KaavioReactEl
			theme={edges}
			onReady={function() {
				console.warn("browser-version of Kaavio is ready");
			}}
			{...data}
			/>,
			userSpecifiedContainer
		);
	}j
}
//*/

/*
export function Kaavio(userSpecifiedContainerInput: any, data) {
  const userSpecifiedContainer = isString(userSpecifiedContainerInput)
    ? document.querySelector(userSpecifiedContainerInput)
    : userSpecifiedContainerInput;

  return ReactDOM.render(
    <KaavioReactEl
      theme={edges}
      onReady={function() {
        console.warn("browser-version of Kaavio is ready");
      }}
      {...data}
    />,
    userSpecifiedContainer
  );
}
//*/
