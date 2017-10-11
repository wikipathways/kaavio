const colorInterpolate = require("color-interpolate");
import { Parser } from "collit";

export function interpolate(parentBackgroundColor, backgroundColor, opacity) {
  if (parentBackgroundColor === backgroundColor) {
    return parentBackgroundColor;
  }
  const colormap = colorInterpolate([parentBackgroundColor, backgroundColor]);
  return Parser.parseRgb(colormap(opacity)).hex;
}
