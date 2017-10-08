import { style } from "typestyle";

export const Global = style({
  fontFamily: "Roboto",
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden"
});

export const Container = style({
  width: "100%",
  height: "100%"
});

export const Diagram = style({
  width: "100%",
  height: "100%"
});

export const Viewport = style({
  [`text`]: {
    fontSize: "12px",
    pointerEvents: "none",
    strokeWidth: "0px"
  }
});

export const Citation = style({
  [` .Icon`]: {
    fill: "none",
    strokeWidth: "0px"
  },
  [` .textlabel`]: {
    fill: "gray",
    fontSize: "10px"
  }
});

export const InfoBox = style({
  fill: "#444",
  [`${Citation}`]: {
    fontSize: "0px"
  }
});
