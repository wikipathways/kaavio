import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioReactEl } from "./Kaavio";

import * as edgeDrawerMap from "./drawers/edges/index";
import * as filterDrawerMap from "./drawers/filters/index";
import * as markerDrawerMap from "./drawers/markers/index";

export function Kaavio(userSpecifiedContainerInput: any, data) {
  const userSpecifiedContainer = isString(userSpecifiedContainerInput)
    ? document.querySelector(userSpecifiedContainerInput)
    : userSpecifiedContainerInput;

  return ReactDOM.render(
    <KaavioReactEl
      edgeDrawerMap={edgeDrawerMap}
      filterDrawerMap={filterDrawerMap}
      markerDrawerMap={markerDrawerMap}
      onReady={function() {
        console.warn("browser-version of Kaavio is ready");
      }}
      {...data}
    />,
    userSpecifiedContainer
  );
}
