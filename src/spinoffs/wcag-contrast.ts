import { Parser, Validator } from "collit";
import { isString } from "lodash/fp";
const luminance = require("relative-luminance").default;

const whiteRelLuminance = 1;
const blackRelLuminance = 0;

export function isValidColor(color) {
  return isString(color) && Validator.isColor(color);
}

export function normalizeHex(hex) {
  return hex.length === 7 ? hex : hex + hex.slice(-3);
}

// see https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
// (L1 + 0.05) / (L2 + 0.05)
export function relLuminancesContrast(relLuminanceLighter, relLuminanceDarker) {
  return (relLuminanceLighter + 0.05) / (relLuminanceDarker + 0.05);
}

export function relLuminance(color) {
  const { r, g, b } = Parser.parseColor(color).rgb;
  return luminance([r, g, b]);
}

export function contrast(foregroundColor, backgroundColor) {
  const foregroundColorRelLuminance = relLuminance(foregroundColor);
  const backgroundColorRelLuminance = relLuminance(backgroundColor);
  return relLuminancesContrast(
    Math.max(foregroundColorRelLuminance, backgroundColorRelLuminance),
    Math.min(foregroundColorRelLuminance, backgroundColorRelLuminance)
  );
}

export function foreground(backgroundColor) {
  const backgroundColorRelLuminance = relLuminance(backgroundColor);
  return relLuminancesContrast(backgroundColorRelLuminance, blackRelLuminance) >
    relLuminancesContrast(whiteRelLuminance, backgroundColorRelLuminance)
    ? "black"
    : "white";
}
