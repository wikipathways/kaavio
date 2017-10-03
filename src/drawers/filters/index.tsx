import * as React from "react";
import * as ReactDOM from "react-dom";
import { normalizeElementId } from "../../utils/normalizeElementId";

export type FilterResponse = { id: string; filterPrimitives: JSX.Element[] };

export function Double({ strokeWidth = 1 }): FilterResponse {
  const source = "SourceGraphic";
  let filterPrimitives;
  if (strokeWidth === 1) {
    filterPrimitives = [
      <feComposite
        in={source}
        in2={source}
        operator="over"
        result="doubleStrokedarkened"
      />,
      <feMorphology
        in={source}
        operator="dilate"
        radius="1"
        result="doubleStrokedilated"
      />,
      <feComposite
        in="doubleStrokedilated"
        in2="doubleStrokedarkened"
        operator="out"
        result="doubleStrokeResult"
      />
    ];
  } else {
    filterPrimitives = [
      <feMorphology
        in={source}
        operator="dilate"
        radius={strokeWidth}
        result="doubleStrokedilated"
      />,
      <feComposite
        in="doubleStrokedilated"
        operator="xor"
        in2={source}
        result="doubleStrokeResult"
      />
    ];
  }

  return {
    id: normalizeElementId(["double", strokeWidth, "filter"].join("-")),
    filterPrimitives: filterPrimitives
  };
}

export function Highlight({ color }): FilterResponse {
  const source = "SourceGraphic";
  return {
    id: normalizeElementId(["highlight", color, "filter"].join("-")),
    filterPrimitives: [
      /* Desaturate all colours before highlighting */
      <feColorMatrix
        in="SourceGraphic"
        type="saturate"
        values="0"
        result="toHighlight"
      />,
      <feFlood floodColor={color} floodOpacity="0.5" result="highlight" />,
      <feComposite in="highlight" in2="toHighlight" operator="atop" />
    ]
  };
}

export function Round({ strokeWidth = 1 }): FilterResponse {
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
  const strokeWidthNormalizationOperator = strokeWidth > normalizedWidth
    ? "contract"
    : "dilate";
  // strangely, this is what appears needed to normalize stroke width to a value
  // large enough to be blurred without being destroyed:
  const radius = strokeWidthNormalizationOperator === "dilate" ? 1 : 0;
  // would have expected this, but it doesn't produce expected results:
  //const radius = (strokeWidthNormalizationOperator === 'dilate') ? (normalizedWidth - strokeWidth) : strokeWidth - normalizedWidth;
  //const radius = Math.abs((normalizedWidth - strokeWidth - 1) / 2 );
  //const radius = Math.abs(normalizedWidth - strokeWidth);

  const strokeWidthRevertOperator = strokeWidthNormalizationOperator ===
    "contract"
    ? "dilate"
    : "contract";

  const normalizedDark = strokeWidth === 1
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
    id: normalizeElementId(["round", strokeWidth, "filter"].join("-")),
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
