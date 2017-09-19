// NOTE other possibly relevant libraries:
// https://www.npmjs.com/package/jsyg-texteditor
//
// https://www.npmjs.com/package/svg-text-wrap:
//   Give a string, a desired width, and some svg style attributes, get back an array
//
// https://www.npmjs.com/package/svg-text-size:
//   Get a {width, height} given a text string (or array) and svg attributes
//   browser-only
//
// https://github.com/reactjs/react-art/blob/master/src/ReactART.js#L539
// https://github.com/ariutta/cross-platform-text/blob/master/lib/svg.js
// https://github.com/d3plus/d3plus-text: depends on d3.js
// https://www.npmjs.com/package/svg-text: browser-only
// https://www.npmjs.com/package/typesettable: browser-only
// https://www.npmjs.com/package/react-text-on-svg
// http://svgjs.com/elements/#svg-text: no vertical or horizontal alignment
//
// https://www.npmjs.com/package/node-calculate-size:
//   Node API and CLI for calculating text sizes using phantomJS.
//
// https://www.npmjs.com/package/word-wrap
// https://www.npmjs.com/package/word-wrappr

import * as React from "react";
import { TextProps } from "../typings";

export class Text extends React.Component<any, any> {
  constructor(props: TextProps) {
    super(props);
  }

  render() {
    const {
      textContent = "",
      width,
      height,
      fontSize = 12,
      fontFamily = "arial",
      fontStyle,
      fontWeight,
      color = "#141414"
    } = this.props;
    const lines = textContent.split("\n");
    const lineSpacing = 2; // In px

    const style = {
      fontSize: `${fontSize}px`,
      fontFamily,
      fontStyle,
      fontWeight
    };

    const SVGText = lines.map((content, i) =>
      <text
        key={`text-line-${i}`}
        textAnchor="middle"
        style={style}
        fill={color}
        dy={
          /* Add an extra offset of the fontSize (plus a spacer) for each line*/
          lines.length > 1 ? (fontSize + lineSpacing) * i : fontSize
        }
      >
        {content}
      </text>
    );

    const SVGTextHeight: number = lines.length > 1
      ? (fontSize + lineSpacing) * lines.length
      : fontSize;

    const shiftX: number = width / 2;
    const shiftY: number = SVGTextHeight / 2;

    return (
      <g transform={`translate(${shiftX},${shiftY})`}>
        {SVGText}
      </g>
    );
  }
}
