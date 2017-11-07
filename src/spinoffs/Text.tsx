// NOTE other possibly relevant libraries:
//
// http://drawsvg.org/drawsvg.html#showcase:text-editor
//   SVG-Edit
//
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

// For more details, see
// http://www.w3.org/TR/SVG11/text.html#TextAnchorProperty
// start | middle | end | inherit
// and
// http://www.w3.org/TR/CSS2/text.html#alignment-prop
// left | right | center | justify | inherit

/* NOTE: this will display text as if the following CSS were in effect:

.text {
  box-sizing: border-box;
  display: table-cell;
  margin: 0px;
}

//*/

const direction = require("direction");
import * as React from "react";

const LTR_CENTRIC_TEXT_ALIGNS = ["left", "right"];

const shiftXCalculatorsByTextAlign = {
  left: function(textDirection, padding, width) {
    return padding;
  },
  start: function(textDirection, padding, width) {
    if (textDirection === "rtl") {
      return width - padding;
    } else {
      return padding;
    }
  },
  center: function(textDirection, padding, width) {
    return width / 2;
  },
  end: function(textDirection, padding, width) {
    if (textDirection === "rtl") {
      return padding;
    } else {
      return width - padding;
    }
  },
  right: function(textDirection, padding, width) {
    return width - padding;
  }
};

const shiftYCalculatorsByContainerVerticalAlign = {
  top: (totalTextHeight, lineHeightPx, padding, height) =>
    padding + totalTextHeight / 2 + lineHeightPx / 2,
  middle: (totalTextHeight, lineHeightPx, padding, height) =>
    height / 2,
  bottom: (totalTextHeight, lineHeightPx, padding, height) =>
    height - padding - totalTextHeight / 2 - lineHeightPx / 2
};

const textAnchorCalculatorsByTextAlign = {
  start: textDirection => "start",
  end: textDirection => "end",
  left: function(textDirection) {
    return "start";
    /*
    if (textDirection === "rtl") {
      return "end";
    } else {
      return "start";
    }
		//*/
  },
  center: function(textDirection) {
    return "middle";
  },
  right: function(textDirection) {
    return "end";
    /*
    if (textDirection === "rtl") {
      return "start";
    } else {
      return "end";
    }
		//*/
  }
};

export interface TextProps {
  color: string;
  height: number; // px
  containerId: string;
  padding: number; // px
  width: number; // px
  verticalAlign: string;
  fontFamily: string;
  fontSize: number; // px
  fontStyle: string;
  fontWeight: string;
  lineHeight: number; // unitless
  overflow: string;
  rotation: number;
  textAlign: "start" | "end" | "left" | "center" | "right";
  textContent: string;
  textOverflow: string;
  whiteSpace: string;
}

export class Text extends React.Component<any, any> {
  constructor(props: TextProps) {
    super(props);
  }

  render() {
    const {
      color,
      height,
      containerId,
      padding = 0,
      width,
      verticalAlign,
      fontFamily,
      fontSize,
      fontStyle = "normal",
      fontWeight = "normal",
      lineHeight: lineHeightUnitless,
      overflow = "visible",
      rotation = 0,
      textAlign = "start",
      textContent = "",
      textOverflow = "clip",
      whiteSpace = "normal"
    }: TextProps = this.props;
    // TODO text-overflow:
    // ellipsis, clip, "…" (string)
    // https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
    //
    // SVG has an overflow property but we need to establish a new viewport to
    // make it work for text or tspan.
    // set a clip path to match clip?
    //
    // Also, there are the textLength and lengthAdjust properties, but they
    // don't seem directly related to the text-overflow property
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/textLength
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/lengthAdjust

    /* TODO does this handle test cases like these?
		// mixed rtl and ltr content:
    const textContent = "exclamation point -- באמת! -- on the right.";
    const textContent = "בצד ימין  -- really! -- סימן קריאה.";
    const textContent = "exclamation point -- באמת!‏ -- on the left.";
    const textContent = "בצד שמאל  -- really‎! -- סימן קריאה.";
	  // multiline rtl:
    const textContent = "אחר \nצהריים טובים";
		// Notice also that PathVisio only produces left, center, right, so the
		// GPML tests don't include start and end!
    const textAlign = "start";
    const textAlign = "end";
		*/
    const ltrCentric = LTR_CENTRIC_TEXT_ALIGNS.indexOf(textAlign) > -1;
    const lineHeightPx = lineHeightUnitless * fontSize;
    // TODO what about writing-mode and Chinese/Japanese scripts?
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/writing-mode
    // https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode
    const textDirection = direction(textContent);
    const textAnchor = textAnchorCalculatorsByTextAlign[textAlign](
      textDirection
    );

    let lines;

    const supportedOverflowValues = ["visible", "hidden"];
    if (supportedOverflowValues.indexOf(overflow) === -1) {
      throw new Error(
        `Only ${supportedOverflowValues.join(
          ", "
        )} currently supported for overflow. Pull requests welcome!`
      );
    }

    const supportedTextOverflowValues = ["clip"];
    if (supportedTextOverflowValues.indexOf(textOverflow) === -1) {
      throw new Error(
        `Only ${supportedTextOverflowValues.join(
          ", "
        )} currently supported for textOverflow. Pull requests welcome!`
      );
    }

    if (whiteSpace === "pre") {
      // These are the most common ways to specify linebreaks:
      const lineBreakRegex = /\r\n|\r|\n|&#xA;|<br>|<br\/>/g;
      lines = textContent.split(lineBreakRegex);
      if (direction(textContent) === "rtl") {
        // U+200E <200e> is https://en.wikipedia.org/wiki/Left-to-right_mark
        // U+200F ‏ is https://en.wikipedia.org/wiki/Right-to-left_mark
        // It seems necessary to prefix the line with U+200E in order to make
        // multiple lines of RTL text split correctly in Chrome, but FF seems
        // to display correctly both with and without.
        lines = lines.map(line => "‎" + line);
        // TODO do we need to add U+200F anywhere to correct for adding the
        // U+200E prefix? Maybe something like this?
        //lines = lines.map(line => "‎" + line.split('').map(character => character + '‏').join(''));
      }
      //} else if (whiteSpace === "normal") {
    } else {
      throw new Error(
        "Only pre currently supported for whiteSpace. Pull requests welcome!"
      );
    }

    const lineCount = lines.length;

    const shiftX: number = shiftXCalculatorsByTextAlign[textAlign](
      textDirection,
      padding,
      width
    );

    const totalTextHeight = (lineCount - 1) * lineHeightPx;
    const shiftY: number = shiftYCalculatorsByContainerVerticalAlign[
      verticalAlign
    ](totalTextHeight, lineHeightPx, padding, height);

    const transforms = [];
    transforms.push(`translate(${shiftX},${shiftY})`);
    if (rotation) {
      transforms.push(
        `rotate(${rotation},
					${width / 2 - shiftX},
					${height / 2 - shiftY})`
      );
    }

    const clipPathId = `${containerId}-text-clipPath`;
    /*
          x={-1 * shiftX}
    y={-1 * height / 2}
              y={-1 * shiftY + lineHeightPx / 2}
		//*/
    return (
      <g>
        <defs>
          <clipPath id={clipPathId}>
            <rect
              x={-1 * shiftX}
              y={-1 * shiftY}
              width={width}
              height={height}
            />
          </clipPath>
        </defs>
        <text
          clipPath={overflow === "hidden" ? `url(#${clipPathId})` : null}
          dominantBaseline="central"
          fill={color}
          fontFamily={fontFamily}
          fontStyle={fontStyle}
          fontWeight={fontWeight}
          overflow={overflow}
          textAnchor={textAnchor}
          transform={transforms.join(" ")}
        >
          {lines.map(function(line, i) {
            // These two are equivalent:
            //y={(i - (lineCount - 1) / 2) * lineHeightPx}
            // and
            //					dy={
            //						i === 0 ? -1 * (lineCount - 1) * lineHeightPx / 2 : lineHeightPx
            //					}
            //
            // NOTE: in Chrome, direction and fontSize need to be applied to the
            // tspan elements, not the parent text element. Otherwise, they don't
            // take effect.
            return (
              <tspan
                key={`text-line-${i}-${line}`}
                direction={ltrCentric ? "ltr" : textDirection}
                fontSize={`${fontSize}px`}
                x="0"
                y={(i - (lineCount - 1) / 2) * lineHeightPx}
              >
                {line}
              </tspan>
            );
          })}
        </text>
      </g>
    );
  }
}

//    const dx = lines
//      .reduce(function(acc, line) {
//        const characterCount = line.length;
//        for (let i = 0; i < characterCount; i++) {
//          acc.push(0);
//        }
//        acc.push(-1 * (fontSize / lineHeightUnitless) * characterCount);
//        return acc;
//      }, [])
//      .join(" ");
//
//    const dy = lines
//      .reduce(
//        function(acc, line) {
//          const characterCount = line.length;
//          for (let i = 0; i < line.length; i++) {
//            acc.push(0);
//          }
//          acc.push(lineHeightPx);
//          return acc;
//        },
//        [-1 * (lines.length - 1) * lineHeightPx / 2]
//      )
//      .join(" ");
//
//    const totalTextWidth =
//      Math.max.apply(undefined, lines.map(line => line.length)) * fontSize / 2;
//    const tspanXMapper = {
//      rtl: {
//        start: -totalTextWidth,
//        middle: 0,
//        end: totalTextWidth
//      },
//      ltr: {
//        start: 0,
//        middle: 0,
//        end: 0
//      }
//    };
//    const tspanX = tspanXMapper[textDirection][textAnchor];
//
//{line.split("").map(character => `‎${character}`).join("")}
//{he.encode(line)}
//    return (
//      <text
//        dominantBaseline="central"
//        dx={dx}
//        dy={dy}
//        textLength="300"
//        fill={color}
//        fontFamily={fontFamily}
//        fontSize={`${fontSize}px`}
//        fontStyle={fontStyle}
//        fontWeight={fontWeight}
//        textAnchor={textAnchor}
//        transform={transforms.join(" ")}
//      >
//        {lines.map(function(line, i) {
//          return (
//            <tspan
//              key={`text-line-${i}-${line}`}
//              textLength={line.length * fontSize / lineHeightUnitless}
//            >
//              {line}
//            </tspan>
//          );
//        })}
//        {/*
//        {textContent}
//        dx={dx}
//        {lines.map(function(line, i) {
//          //x={tspanX}
//          //dy={(i - (lineCount - 1) / 2) * lineHeightPx}
//          return (
//            <tspan
//              key={`text-line-${i}-${line}`}
//              x="0"
//              dy={
//                i === 0 ? -1 * (lineCount - 1) * lineHeightPx / 2 : lineHeightPx
//              }
//            >
//              {line}
//            </tspan>
//          );
//        })}
//					*/}
//      </text>
//    );

/*
function getTextPathXValues(padding, textDirection, width) {
  if (textDirection === "rtl") {
    return [width - padding, padding];
  } else {
    return [padding, width - padding];
  }
}
//*/

/* In case I ever want to render text on edges, here's a start
			const [x0, x1] = getTextPathXValues(
				padding,
				textDirection,
				width
			);
      const length = Math.floor(height / (lineHeightPx));
      const d = fill("", 0, length, Array(length))
        .map(function(p, i) {
          const y = (lineHeightPx) * (i + 1);
          return `M ${x0} ${y} L ${x1} ${y}`;
        })
        .join("\n");
      const pathId = `mypath-for-${containerId}`;
      return (
        <g>
          <path id={pathId} d={d} />
          <text
            textAnchor={textAnchor}
            dx={xTranslation}
            style={style}
            fill={color}
            dominantBaseline="central"
          >
            <textPath xlinkHref={`#${pathId}`}>
              {textContent.replace(lineBreakRegex, "")}
            </textPath>
          </text>
        </g>
		//*/
