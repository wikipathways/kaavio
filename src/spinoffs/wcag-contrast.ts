import { Parser } from "collit";
const luminance = require("relative-luminance");

const whiteRelLuminance = 1;
const blackRelLuminance = 0;

// see https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
// (L1 + 0.05) / (L2 + 0.05)
export function relLuminancesContrast(relLuminanceLighter, relLuminanceDarker) {
  return (relLuminanceLighter + 0.05) / (relLuminanceDarker + 0.05);
}

export function relLuminance(color) {
  const { r, g, b } = Parser.parseColor(color).rgb;
  return luminance([r, g, b]);
}

export function foreground(backgroundColor) {
  const backgroundColorRelLuminance = relLuminance(backgroundColor);
  return relLuminancesContrast(backgroundColorRelLuminance, blackRelLuminance) >
    relLuminancesContrast(whiteRelLuminance, backgroundColorRelLuminance)
    ? "black"
    : "white";
}
