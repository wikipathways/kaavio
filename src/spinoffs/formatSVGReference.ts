/* Given a string, return either a valid IRI or a text string
 * that will serve as the value for an SVG reference.
 *
 * We want to avoid making a FuncIRI out of any of the names in STRING_REFERENCE_VALUES or a color.
 *
 * See these references:
 *   https://www.w3.org/TR/SVG/linking.html#IRIforms
 *   https://www.w3.org/TR/SVGTiny12/linking.html#IRIReference
 *
 * Examples:
 *   stroke="none"
 *   fill="#fff"
 *   fill="#ffffff"
 *   fill="rgb(255,255,255)"
 *   fill="rgb(100%,100%,100%)"
 *   use="url(#MyShape)"
 *   style="fill:url(#MyGradient)"
 */

// TODO what about data URIs (maybe applicable to SVG 1.2 Tiny, not SVG 1.1)?

// TODO what about values for the src attribute for color profiles,
// especially ones like "local(" + <string> + ")"?
// These are the allowed values:
// sRGB | <local-profile> | <iri> | (<local-profile> <iri>) | inherit
// https://www.w3.org/TR/SVG/color.html#ColorProfileSrcProperty

import { find, map, reduce } from "lodash/fp";
const urlRegex = require("url-regex");
import { Validator } from "collit";

export type StringReferenceValue = "none" | "inherit" | "currentColor";

interface Formatter {
  type: string;
  test: (input: string) => boolean;
  format: (input: string) => string;
}

export const STRING_REFERENCE_VALUES: ReadonlyArray<StringReferenceValue> = [
  "none",
  "inherit",
  "currentColor"
];

function getFuncIRI(iri: string): string {
  return `url(${iri})`;
}

const formatters: Formatter[] = [
  {
    type: "string",
    test: (input: StringReferenceValue & string): boolean =>
      STRING_REFERENCE_VALUES.indexOf(input) > -1,
    format: (input: StringReferenceValue): StringReferenceValue => input
  },
  {
    type: "nonLocalIRI",
    // relative URL
    test: (input: string): boolean =>
      urlRegex({ strict: true, exact: true }).test(input) ||
      input.match(/^(\/|\.\/|\.\.\/)/),
    format: getFuncIRI
  },
  {
    type: "color",
    test: (input: string): boolean => Validator.isColor(input),
    format: (input: string): string => input
  },
  {
    type: "localIRI",
    test: (input: string): boolean => true,
    format: (input: string): string => getFuncIRI("#" + input)
  }
];

const formatterTypes = map(({ type }) => type, formatters);

const formatterMap = reduce(
  function(acc, { type, test, format }) {
    acc[type] = { type, test, format };
    return acc;
  },
  {},
  formatters
);

function getSVGReferenceFormatter(
  input: StringReferenceValue | string,
  potentialFormatterTypes: string[] = formatterTypes
): Formatter {
  const potentialFormatterTypeCount = potentialFormatterTypes.length;
  if (potentialFormatterTypeCount === 1) {
    const formatterType = potentialFormatterTypes[0];
    return formatterMap[formatterType];
  } else {
    return find(function({ type, test }) {
      return potentialFormatterTypes.indexOf(type) > -1 && test(input);
    }, formatters);
  }
}

export function getSVGReferenceType(
  input: StringReferenceValue | string,
  potentialFormatterTypes: string[] = formatterTypes
): StringReferenceValue | string {
  return getSVGReferenceFormatter(input, potentialFormatterTypes).type;
}

export function formatSVGReference(
  input: StringReferenceValue | string,
  potentialFormatterTypes: string[] = formatterTypes
): StringReferenceValue | string {
  return getSVGReferenceFormatter(input, potentialFormatterTypes).format(input);
}
