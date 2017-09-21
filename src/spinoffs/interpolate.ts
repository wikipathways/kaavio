import * as colorInterpolate from "color-interpolate";
import * as rgb2hex from "rgb2hex";

export function interpolate(parentBackgroundColor, backgroundColor, opacity) {
  if (parentBackgroundColor === backgroundColor) {
    return parentBackgroundColor;
  }
  const colormap = colorInterpolate([parentBackgroundColor, backgroundColor]);
  return rgb2hex(colormap(opacity)).hex;
}
