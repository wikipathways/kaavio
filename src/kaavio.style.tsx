import { style } from "typestyle";

const kaavioBackgroundColor = "white";
const kaavioColor = "black";

export const globalClass = style({
  fontFamily: "Roboto",
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden"
});

export const containerClass = style({
  color: kaavioColor,
  backgroundColor: kaavioBackgroundColor,
  width: "100%",
  height: "100%"
});

export const diagramClass = style({
  backgroundColor: kaavioBackgroundColor,
  width: "100%",
  height: "100%"
});

export const viewportClass = style({
  [`.kaavio-viewport-background`]: {
    fill: kaavioBackgroundColor
  },
  [`text`]: {
    fontSize: "12px",
    pointerEvents: "none",
    strokeWidth: "0px"
  }
});

export const CitationClass = style({
  [` .Icon`]: {
    fill: "none",
    strokeWidth: "0px"
  },
  [` .textlabel`]: {
    fill: "gray",
    fontSize: "10px"
  }
});

export const InfoBoxClass = style({
  fill: "#444",
  [`${CitationClass}`]: {
    fontSize: "0px"
  }
});
