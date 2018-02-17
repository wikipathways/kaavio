import * as React from "react";
import * as ReactDOM from "react-dom";
import { isString } from "lodash/fp";
import { Kaavio as KaavioReactEl } from "./Kaavio";

import * as edges from "./drawers/edges/index";

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
