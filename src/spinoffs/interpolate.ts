const colorInterpolate = require("color-interpolate");
const rgb2hex = require("rgb2hex");

export function interpolate(parentBackgroundColor, backgroundColor, opacity) {
  if (parentBackgroundColor === backgroundColor) {
    return parentBackgroundColor;
  }
  const colormap = colorInterpolate([parentBackgroundColor, backgroundColor]);
  return rgb2hex(colormap(opacity)).hex;
}
