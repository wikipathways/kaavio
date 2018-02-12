const colorInterpolate = require("color-interpolate");
import { Parser } from "collit";

export function interpolate(parentBackgroundColor, backgroundColor, opacity) {
  if (parentBackgroundColor === backgroundColor) {
    return parentBackgroundColor;
  }
  const colormap = colorInterpolate([parentBackgroundColor, backgroundColor]);
  // NOTE: colormap appears to usually return an RGB color but sometimes an RGBA color.
  return Parser.parseColor(colormap(opacity)).hex;
}
