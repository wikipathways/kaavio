import * as React from "react";
import * as ReactDOM from "react-dom";
import { normalizeElementId } from "../../utils/normalizeElementId";

export type FilterResponse = {
  filterProperties: {
    id: string;
    filterUnits?: string;
    width?: string;
    height?: string;
    x?: string;
    y?: string;
    filterRes?: number;
  };
  filterPrimitives: JSX.Element[];
};

export function Double1({
  backgroundColor,
  borderWidth = 1,
  color,
  parentBackgroundColor
}): FilterResponse {
  const source = "SourceGraphic";
  const hasFill = ["none", "transparent"].indexOf(backgroundColor) === -1;

  let filterPrimitives;

  if (borderWidth === 1) {
    filterPrimitives = [
      <feComposite
        in={source}
        in2={source}
        operator="over"
        key="doubleDark"
        result="doubleDark"
      />,
      <feMorphology
        in="doubleDark"
        operator="dilate"
        radius={hasFill ? 1 : 0.5}
        key="doubleInner"
        result="doubleInner"
      />,
      <feMorphology
        in={source}
        operator="dilate"
        radius={hasFill ? 2 : 1}
        key="doubleOuter"
        result="doubleOuter"
      />
    ];
  } else {
    filterPrimitives = [
      <feMorphology
        in={source}
        operator="dilate"
        radius={borderWidth}
        key="doubleOuter"
        result="doubleOuter"
      />,
      <feMorphology
        in={source}
        operator={hasFill ? "erode" : "dilate"}
        radius={hasFill ? borderWidth / 2 : 1 / 3}
        key="doubleInner"
        result="doubleInner"
      />
    ];
  }

  const composited = hasFill
    ? <feComposite
        in="doubleInner"
        in2="doubleOuter"
        operator="atop"
        key="doubleResult"
        result="doubleResult"
      />
    : <feComposite
        in="doubleOuter"
        in2="doubleInner"
        operator="out"
        key="doubleResult"
        result="doubleResult"
      />;

  filterPrimitives.push(composited);

  return {
    filterProperties: {
      id: normalizeElementId(
        ["double", hasFill, borderWidth, "filter"].join("-")
      )
    },
    filterPrimitives: filterPrimitives
  };
}

export function Double2({
  backgroundColor,
  borderWidth = 1,
  color,
  parentBackgroundColor
}): FilterResponse {
  const source = "SourceGraphic";
  const hasFill = ["none", "transparent"].indexOf(backgroundColor) === -1;

  let filterPrimitives = [];

  if (borderWidth === 1) {
    filterPrimitives = [
      <feComposite
        in={source}
        in2={source}
        operator="over"
        key="doubleDark"
        result="doubleDark"
      />,
      <feMorphology
        in="doubleDark"
        operator="dilate"
        radius={hasFill ? 1 : 0.5}
        key="doubleInner"
        result="doubleInner"
      />,
      <feMorphology
        in={source}
        operator="dilate"
        radius={hasFill ? 2 : 1}
        key="doubleOuter"
        result="doubleOuter"
      />
    ];
  } else {
    filterPrimitives = [
      <feMorphology
        in={source}
        operator={hasFill ? "erode" : "dilate"}
        radius={hasFill ? borderWidth / 2 : 1 / 3}
        key="doubleInner"
        result="doubleInner"
      />,
      <feMorphology
        in={source}
        operator="dilate"
        radius={borderWidth}
        key="doubleOuter"
        result="doubleOuter"
      />
    ];
  }
  const composited = hasFill
    ? <feComposite
        in="doubleInner"
        in2="doubleOuter"
        operator="atop"
        key="doubleResult"
        result="doubleResult"
      />
    : <feComposite
        in="doubleOuter"
        in2="doubleInner"
        operator="out"
        key="doubleResult"
        result="doubleResult"
      />;

  filterPrimitives.push(composited);

  return {
    filterProperties: {
      id: normalizeElementId(
        ["double", hasFill, borderWidth, "filter"].join("-")
      )
      /*
      width: "200%",
      height: "200%",
      x: "-50%",
      y: "-50%",
      filterRes: 1000
			//*/
    },
    filterPrimitives: filterPrimitives
  };
}

export function Double({
  backgroundColor,
  borderWidth = 1,
  color,
  parentBackgroundColor
}): FilterResponse {
  const source = "SourceGraphic";
  const hasFill = ["none", "transparent"].indexOf(backgroundColor) === -1;

  let filterPrimitives = [];

  let innerRadius;
  if (borderWidth <= 1) {
    innerRadius = hasFill ? 1 : 0.5;
  } else {
    innerRadius = hasFill ? -1 * borderWidth / 2 : 1 / 3;
  }

  if (!hasFill) {
    filterPrimitives.push(
      <feComposite
        in={source}
        in2={source}
        operator="over"
        key="doubleDark"
        result="doubleDark"
      />
    );
    filterPrimitives.push(
      <feMorphology
        in="doubleDark"
        operator={innerRadius < 0 ? "erode" : "dilate"}
        radius={Math.abs(innerRadius)}
        key="doubleInner"
        result="doubleInner"
      />
    );
  } else {
    filterPrimitives.push(
      <feMorphology
        in={source}
        operator={innerRadius < 0 ? "erode" : "dilate"}
        radius={Math.abs(innerRadius)}
        key="doubleInner"
        result="doubleInner"
      />
    );
  }

  const outerRadius = hasFill
    ? Math.max(2, borderWidth)
    : Math.max(1, borderWidth);

  filterPrimitives.push(
    <feMorphology
      in={source}
      operator="dilate"
      radius={outerRadius}
      key="doubleOuter"
      result="doubleOuter"
    />
  );

  const composited = hasFill
    ? <feComposite
        in="doubleInner"
        in2="doubleOuter"
        operator="atop"
        key="doubleResult"
        result="doubleResult"
      />
    : <feComposite
        in="doubleOuter"
        in2="doubleInner"
        operator="out"
        key="doubleResult"
        result="doubleResult"
      />;

  filterPrimitives.push(composited);

  return {
    filterProperties: {
      id: normalizeElementId(
        ["double", hasFill, borderWidth, "filter"].join("-")
      )
      /*
      width: "200%",
      height: "200%",
      x: "-50%",
      y: "-50%",
      filterRes: 1000
			//*/
    },
    filterPrimitives: filterPrimitives
  };
}

export function Highlight({ color }): FilterResponse {
  const source = "SourceGraphic";
  return {
    filterProperties: {
      id: normalizeElementId(["highlight", color, "filter"].join("-")),
      filterUnits: "userSpaceOnUse"
    },
    filterPrimitives: [
      /* Desaturate all colours before highlighting */
      <feColorMatrix type="saturate" values="0" key="saturated" />,
      <feFlood floodColor={color} floodOpacity="1" key="flooded" />,
      <feComposite operator="atop" in2="SourceGraphic" key="flood-composite" />,
      <feMorphology operator="dilate" radius="4" key="dilated" />,
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
  parentBackgroundColor
}): FilterResponse {
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
      id: normalizeElementId(["round", borderWidth, "filter"].join("-"))
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
