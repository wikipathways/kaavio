import * as React from "react";
import * as ReactDOM from "react-dom";

function getMorphProps(radius: number) {
  return {
    operator: radius < 0 ? "erode" : "dilate",
    radius: Math.abs(radius)
  };
}

export function Double({
  backgroundColor,
  borderWidth = 1,
  color,
  getNamespacedId,
  parentBackgroundColor
}: FilterRequestProps): FilterResponse {
  const source = "SourceGraphic";
  const hasFill = ["none", "transparent"].indexOf(backgroundColor) === -1;

  let filterPrimitives;
  const inPrimitiveName = "inDouble";
  const in2PrimitiveName = "in2Double";
  let inRadius;
  let compositeOperator;

  // almost impossible to see a double line if it's under 1px wide.
  const minBorderWidth = Math.max(borderWidth, 1);

  if (!hasFill) {
    compositeOperator = "out";

    // Sets the width of the thick line.
    inRadius = minBorderWidth;

    // Related to setting the width of the inner stripe that splits the thick
    // line, although visual inspection shows it's setting something else,
    // because the stripe width doesn't equal inRadius2 or 2 * inRadius2.
    // NOTE: FF seems to need this, but Chrome does not.
    const in2Radius = 1 / minBorderWidth / 2;

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
    const in2Radius = minBorderWidth;

    // Appears to be related to setting the inside line.
    inRadius = -1 * minBorderWidth;

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
      id: getNamespacedId(["double", hasFill, borderWidth, "filter"].join("-")),
      width: "200%",
      height: "200%",
      x: "-50%",
      y: "-50%"
    },
    filterPrimitives: filterPrimitives
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
  backgroundColor,
  borderWidth = 1,
  color,
  getNamespacedId,
  parentBackgroundColor
}: FilterRequestProps): FilterResponse {
  const source = "SourceGraphic";
  // Can we handle a borderWidth of 0.4?
  //const roundedStrokeWidth = Math.max(1, Math.round(borderWidth || 1));

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
  //const borderWidthNormalizationOperator = (borderWidth > 2) ? 'contract' : 'dilate';
  const borderWidthNormalizationOperator = borderWidth > normalizedWidth
    ? "contract"
    : "dilate";
  // strangely, this is what appears needed to normalize stroke width to a value
  // large enough to be blurred without being destroyed:
  const radius = borderWidthNormalizationOperator === "dilate" ? 1 : 0;
  // would have expected this, but it doesn't produce expected results:
  //const radius = (borderWidthNormalizationOperator === 'dilate') ? (normalizedWidth - borderWidth) : borderWidth - normalizedWidth;
  //const radius = Math.abs((normalizedWidth - borderWidth - 1) / 2 );
  //const radius = Math.abs(normalizedWidth - borderWidth);

  const borderWidthRevertOperator = borderWidthNormalizationOperator ===
    "contract"
    ? "dilate"
    : "contract";

  const normalizedDark = borderWidth === 1
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
          operator={borderWidthNormalizationOperator}
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
          operator={borderWidthNormalizationOperator}
          radius={radius}
          result="roundnormalized"
        />
      ];

  return {
    filterProperties: {
      id: getNamespacedId(["round", borderWidth, "filter"].join("-"))
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
        operator={borderWidthRevertOperator}
        radius={radius}
        result="roundResult"
      />
    ])
  };
}
