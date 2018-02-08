import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioReactEl } from "./Kaavio";

//const customHTMLStyle = require("./customHTMLStyle.css");
//const customSVGStyle = require("./customSVGStyle.css");

import * as edgeDrawerMap from "./drawers/edges/index";
import * as filterDrawerMap from "./drawers/filters/index";
//import { Icons } from "./drawers/icons/__bundled_dont_edit__";
import * as markerDrawerMap from "./drawers/markers/index";

export function Kaavio(userSpecifiedContainerInput: any, data) {
  const userSpecifiedContainer = isString(userSpecifiedContainerInput)
    ? document.querySelector(userSpecifiedContainerInput)
    : userSpecifiedContainerInput;

  return ReactDOM.render(
    <KaavioReactEl
      //customSVGStyle={customSVGStyle}
      Defs={data.Defs}
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
