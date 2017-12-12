import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioReactEl } from "./Kaavio";

//const customStyleHTML = require("./customStyleHTML.css");
//const customStyleSVG = require("./customStyleSVG.css");

import * as edgeDrawerMap from "./drawers/edges/index";
import * as filterDrawerMap from "./drawers/filters/index";
import { Icons } from "./drawers/icons/__bundled_dont_edit__";
import * as markerDrawerMap from "./drawers/markers/index";

export function Kaavio(userSpecifiedContainerInput: any, data) {
  const userSpecifiedContainer = isString(userSpecifiedContainerInput)
    ? document.querySelector(userSpecifiedContainerInput)
    : userSpecifiedContainerInput;

  return ReactDOM.render(
    <KaavioReactEl
      //customStyleSVG={customStyleSVG}
      Icons={Icons}
      edgeDrawerMap={edgeDrawerMap}
      filterDrawerMap={filterDrawerMap}
      markerDrawerMap={markerDrawerMap}
      pathway={data.pathway}
      entityMap={data.entityMap}
      onReady={function() {
        console.warn("browser-version of Kaavio is ready");
      }}
    />,
    userSpecifiedContainer
  );
}
