import * as React from "react";
import * as ReactDOM from "react-dom";
import { FilterResponse, FilterRequestProps } from "../../types";
import { Parser } from "collit";
import { isValidColor, normalizeHex } from "../../spinoffs/wcag-contrast";

function getMorphProps(radius: number) {
  return {
    operator: radius < 0 ? "erode" : "dilate",
    radius: Math.abs(radius)
  };
}

export function Double({
  fill,
  strokeWidth = 1,
  getNamespacedId
}: FilterRequestProps): FilterResponse {
  const source = "SourceGraphic";
  const hasFill = ["none", "transparent"].indexOf(fill) === -1;

  let filterPrimitives;
  const inPrimitiveName = "inDouble";
  const in2PrimitiveName = "in2Double";
  let inRadius;
  let compositeOperator;

  // almost impossible to see a double line if it's under 1px wide.
  const minStrokeWidth = Math.max(strokeWidth, 1);

  if (!hasFill) {
    compositeOperator = "out";

    // Sets the width of the thick line.
    inRadius = minStrokeWidth;

    // Related to setting the width of the inner stripe that splits the thick
    // line, although visual inspection shows it's setting something else,
    // because the stripe width doesn't equal inRadius2 or 2 * inRadius2.
    // NOTE: FF seems to need this, but Chrome does not.
    const in2Radius = 1 / minStrokeWidth / 2;

    filterPrimitives = [
      // darken
      <feComposite
        in={source}
        in2={source}
        operator="over"
        key="doubleDark"
        result="doubleDark"
      />,
      <feMorphology
        in="doubleDark"
        key={in2PrimitiveName}
        result={in2PrimitiveName}
        {...getMorphProps(in2Radius)}
      />
    ];
  } else {
    compositeOperator = "atop";

    // Appears to be related to setting the outside line.
    const in2Radius = minStrokeWidth;

    // Appears to be related to setting the inside line.
    inRadius = -1 * minStrokeWidth;

    filterPrimitives = [
      <feMorphology
        in={source}
        key={in2PrimitiveName}
        result={in2PrimitiveName}
        {...getMorphProps(in2Radius)}
      />
    ];
  }

  filterPrimitives.push(
    <feMorphology
      in={source}
      key={inPrimitiveName}
      result={inPrimitiveName}
      {...getMorphProps(inRadius)}
    />
  );

  filterPrimitives.push(
    <feComposite
      in={inPrimitiveName}
      in2={in2PrimitiveName}
      operator={compositeOperator}
      key="doubleResult"
      result="doubleResult"
    />
  );

  return {
    filterProperties: {
      id: getNamespacedId(["double", hasFill, strokeWidth, "filter"].join("-")),
      width: "200%",
      height: "200%",
      x: "-50%",
      y: "-50%"
    },
    filterPrimitives: filterPrimitives
  };
}

export function BlackToColor({
  color,
  getNamespacedId
}: FilterRequestProps): FilterResponse | "none" {
  const source = "SourceGraphic";

  if (!isValidColor(color)) {
    return "none";
  }
  const { rgb, hex } = Parser.parseColor(color);
  const { r, g, b, a } = rgb;
  const id = getNamespacedId(
    ["BlackTo", normalizeHex(hex), "filter"].join("-")
  );
  return {
    filterProperties: {
      id: id,
      filterUnits: "userSpaceOnUse"
    },
    filterPrimitives: [
      <feColorMatrix
        key={id}
        type="matrix"
        in="SourceGraphic"
        values={`-1   0   0 0 ${r / 255}
                  0  -1   0 0 ${g / 255}
                  0   0  -1 0 ${b / 255}
                  0   0   0 1 0`}
      />
    ]
  };
}

export function WhiteToColor({
  color,
  getNamespacedId
}: FilterRequestProps): FilterResponse | "none" {
  const source = "SourceGraphic";

  if (!isValidColor(color)) {
    return "none";
  }

  const { rgb, hex } = Parser.parseColor(color);
  const { r, g, b, a } = rgb;
  const id = getNamespacedId(
    ["WhiteTo", normalizeHex(hex), "filter"].join("-")
  );

  return {
    filterProperties: {
      id: id,
      filterUnits: "userSpaceOnUse"
    },
    filterPrimitives: [
      <feColorMatrix
        key={id}
        type="matrix"
        in="SourceGraphic"
        values={`1  0  0 0 -${r / 255}
                 0  1  0 0 -${g / 255}
                 0  0  1 0 -${b / 255}
                 0  0  0 1 0`}
      />
    ]
  };
}

export function Highlight({
  color,
  getNamespacedId
}: FilterRequestProps): FilterResponse {
  const source = "SourceGraphic";
  return {
    filterProperties: {
      id: getNamespacedId(["highlight", color, "filter"].join("-")),
      filterUnits: "userSpaceOnUse"
    },
    filterPrimitives: [
      /* Desaturate all colours before highlighting */
      <feColorMatrix type="saturate" values="0" key="saturated" />,
      <feFlood floodColor={color} floodOpacity="1" key="flooded" />,
      <feComposite operator="atop" in2="SourceGraphic" key="flood-composite" />,
      <feMorphology key="dilated" {...getMorphProps(4)} />,
      <feGaussianBlur stdDeviation="3" key="blur" />,
      <feMerge key="merged">
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    ]
  };
}

export function Round({
  strokeWidth = 1,
  getNamespacedId
}: FilterRequestProps): FilterResponse {
  const source = "SourceGraphic";
  // Can we handle a strokeWidth of 0.4?
  //const roundedStrokeWidth = Math.max(1, Math.round(strokeWidth || 1));

  // C' = slope * C + intercept
  // where C is the initial component (e.g., ‘feFuncR’),
  //       C' is the remapped component;
  //       both in the closed interval [0,1].
  // http://www.w3.org/TR/filter-effects/#feComponentTransferElement
  const darkInputSlope = 1.5;
  const darkInputIntercept = 0;

  const darkOutputSlope = 4;
  const darkOutputIntercept = -0.7;

  const normalizedWidth = 3;
  //const strokeWidthNormalizationOperator = (strokeWidth > 2) ? 'contract' : 'dilate';
  const strokeWidthNormalizationOperator =
    strokeWidth > normalizedWidth ? "contract" : "dilate";
  // strangely, this is what appears needed to normalize stroke width to a value
  // large enough to be blurred without being destroyed:
  const radius = strokeWidthNormalizationOperator === "dilate" ? 1 : 0;
  // would have expected this, but it doesn't produce expected results:
  //const radius = (strokeWidthNormalizationOperator === 'dilate') ? (normalizedWidth - strokeWidth) : strokeWidth - normalizedWidth;
  //const radius = Math.abs((normalizedWidth - strokeWidth - 1) / 2 );
  //const radius = Math.abs(normalizedWidth - strokeWidth);

  const strokeWidthRevertOperator =
    strokeWidthNormalizationOperator === "contract" ? "dilate" : "contract";

  const normalizedDark =
    strokeWidth === 1
      ? [
          <feBlend
            in="SourceGraphic"
            in2="SourceGraphic"
            mode="multiply"
            result="rounddarkinput"
          />,
          <feBlend
            in="rounddarkinput"
            in2="rounddarkinput"
            mode="multiply"
            result="roundnormalizeddarkinput"
          />,
          <feMorphology
            in="roundnormalizeddarkinput"
            operator={strokeWidthNormalizationOperator}
            radius={radius}
            result="roundnormalized"
          />
        ]
      : [
          <feBlend
            in="SourceGraphic"
            in2="SourceGraphic"
            mode="multiply"
            result="roundnormalizeddarkinput"
          />,
          <feMorphology
            in="roundnormalizeddarkinput"
            operator={strokeWidthNormalizationOperator}
            radius={radius}
            result="roundnormalized"
          />
        ];

  return {
    filterProperties: {
      id: getNamespacedId(["round", strokeWidth, "filter"].join("-"))
    },
    filterPrimitives: normalizedDark.concat([
      <feGaussianBlur
        in="roundnormalized"
        stdDeviation={3 * 2}
        result="roundblurred"
      />,
      <feColorMatrix
        in="roundblurred"
        mode="matrix"
        values={`1   0   0   0   0
                            0   1   0   0   0
                            0   0   1   0   0
                            0   0   0  17  -3`}
        result="roundcolored"
      />,
      <feBlend
        in="roundcolored"
        in2="roundcolored"
        mode="multiply"
        result="rounddarkoutput"
      />,
      <feBlend
        in="rounddarkoutput"
        in2="rounddarkoutput"
        mode="multiply"
        result="rounddarkeroutput"
      />,
      <feMorphology
        in="rounddarkeroutput"
        operator={strokeWidthRevertOperator}
        radius={radius}
        result="roundResult"
      />
    ])
  };
}
