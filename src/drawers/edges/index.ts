import * as createSVGPathCalculator from "point-at-length";
import { toPoints } from "svg-points";

export interface ColinMeinkeSVGPoint {
  x: number;
  y: number;
  curve?: any;
  moveTo?: any;
}

export class SVGPointElement implements SVGPoint {
  x: number;
  y: number;
  matrixTransform;
  // NOTE: orientation is not actually a property of SVGPoint
  orientation: any;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
export type PathDataCommand =
  | "M"
  | "m"
  | "Z"
  | "z"
  | "L"
  | "l"
  | "H"
  | "h"
  | "V"
  | "v"
  | "C"
  | "c"
  | "S"
  | "s"
  | "Q"
  | "q"
  | "T"
  | "t"
  | "A"
  | "a"
  | "B"
  | "b"
  | "R"
  | "r";
export class SVGPathSegment {
  type: PathDataCommand;
  values: number[];
  constructor(type: PathDataCommand, values: number[]) {
    this.type = type;
    this.values = values;
  }
}
export interface SVGPathDataSettings {
  normalize: boolean; // default false
}
export interface SVGPathData {
  getPathData: (settings?: SVGPathDataSettings) => SVGPathSegment[];
  setPathData: (pathData: SVGPathSegment[]) => void;
}
export class SVGPath implements SVGPathData {
  pathData: SVGPathSegment[];
  pathCalculator: {
    at: (length: number) => [number, number];
    length: () => number;
  };
  getPathDataFromPoints: (
    points: SVGPointElement[],
    markerStart?: string,
    markerEnd?: string
  ) => SVGPathSegment[];
  d: string;
  points: ColinMeinkeSVGPoint[];
  constructor(points: SVGPointElement[], getPathDataFromPoints) {
    this.getPathDataFromPoints = getPathDataFromPoints;
    this.pathData = getPathDataFromPoints(points);
    this.d = this.getPathStringFromPathData(this.pathData);
    this.points = toPoints({
      type: "path",
      d: this.d
    });
    this.pathCalculator = createSVGPathCalculator(this.d);
  }
  getPathStringFromPathData = (pathData: SVGPathSegment[]): string => {
    return pathData
      .map(function(pathSegment) {
        return pathSegment.type + pathSegment.values.join(",");
      })
      .join("");
  };
  getPointAtLength = (length: number): SVGPointElement => {
    const [x, y] = this.pathCalculator.at(length);
    return new SVGPointElement(x, y);
  };
  getTotalLength = (): number => {
    return this.pathCalculator.length();
  };
  getPathData = (settings?: SVGPathDataSettings): SVGPathSegment[] => {
    return this.pathData;
  };
  setPathData = (pathData: SVGPathSegment[]) => {
    this.pathData = pathData;
    this.d = this.getPathStringFromPathData(this.pathData);
    this.pathCalculator = createSVGPathCalculator(this.d);
  };
  getPointAtPosition = (position: number): SVGPointElement => {
    const totalLength = this.getTotalLength();
    return this.getPointAtLength(position * totalLength);
  };
}

// Returns the dot product of the given four-element vectors.
function d3_svg_lineDot4(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export class StraightLine extends SVGPath {
  constructor(points: SVGPointElement[]) {
    super(points, function getPathDataFromPoints(points) {
      const { x: x0, y: y0 } = points[0];
      const { x: x1, y: y1 } = points[points.length - 1];
      return [
        new SVGPathSegment("M", [x0, y0]),
        new SVGPathSegment("L", [x1, y1])
      ];
    });
  }
}

// Matrix to transform basis (b-spline) control points to bezier
// control points. Derived from FvD 11.2.8.
const d3_svg_lineBasisBezier1 = [0, 2 / 3, 1 / 3, 0];
const d3_svg_lineBasisBezier2 = [0, 1 / 3, 2 / 3, 0];
const d3_svg_lineBasisBezier3 = [0, 1 / 6, 2 / 3, 1 / 6];

// Pushes a "C" Bézier curve onto the specified path array, given the
// two specified four-element arrays which define the control points.
function lineBasisBezier(pathData, x, y) {
  var pointsForBezier = [];
  pointsForBezier.push([
    d3_svg_lineDot4(d3_svg_lineBasisBezier1, x),
    d3_svg_lineDot4(d3_svg_lineBasisBezier1, y)
  ]);

  pointsForBezier.push([
    d3_svg_lineDot4(d3_svg_lineBasisBezier2, x),
    d3_svg_lineDot4(d3_svg_lineBasisBezier2, y)
  ]);

  pointsForBezier.push([
    d3_svg_lineDot4(d3_svg_lineBasisBezier3, x),
    d3_svg_lineDot4(d3_svg_lineBasisBezier3, y)
  ]);

  pathData.push(new SVGPathSegment("C", pointsForBezier));
}

function changeDirection(currentDirection) {
  var xDirection = Math.abs(Math.abs(currentDirection[0]) - 1);
  var yDirection = Math.abs(Math.abs(currentDirection[1]) - 1);
  return [xDirection, yDirection];
}

export class CurvedLine extends SVGPath {
  constructor(points: SVGPointElement[], markerStart, markerEnd) {
    super(points, function getPathDataFromPoints(
      elbowPoints,
      markerStart,
      markerEnd
    ) {
      // modified from d3js: https://github.com/mbostock/d3/blob/ed54503fc7781d8bfe9e9fe125b76b9bbb5ac05c/src/svg/line.js
      // TODO this code is kind of hacky. it seems to work OK, but it's probably confusing and should be refactored for readability/maintainability.

      var elbowPointCount = elbowPoints.length;
      var firstPoint = elbowPoints[0];
      var lastPoint = elbowPoints[elbowPointCount - 1];
      var points = [];
      points.push(firstPoint);

      var lastSegment = [];
      var pathData = [new SVGPathSegment("M", [firstPoint.x, firstPoint.y])];

      var direction = [];
      if (firstPoint.orientation) {
        const orientation = firstPoint.orientation;
        direction.push(orientation[0]);
        direction.push(orientation[1]);
      } else {
        console.error(points);
        throw new Error(
          "No orientation specified for curvedline edge w/ points logged above"
        );
      }

      // for curves, I'm calculating and using the points representing the elbow vertices, from the given points (which represent the first point, any elbow segment mid-points and the last point).
      // I'm making sure the curve passes through the midpoint of the marker side that is furthest away from the node it is attached to
      // TODO this code might be confusing, because it involves redefining the points. Look at refactoring it for readability.
      var markerHeightFactor = 0.75;
      if (
        !!markerStart &&
        firstPoint.orientation &&
        typeof firstPoint.orientation[0] !== "undefined" &&
        typeof firstPoint.orientation[1] !== "undefined"
      ) {
        var firstPointWithOffset: any = {};
        var firstOffset;
        var firstMarkerData = { x: 0, y: 0, markerWidth: 12, markerHeight: 12 };
        if (!!firstMarkerData) {
          firstOffset = markerHeightFactor * firstMarkerData.markerHeight;
        } else {
          firstOffset = 12;
        }
        firstPointWithOffset.x =
          firstPoint.orientation[0] * firstOffset + firstPoint.x;
        firstPointWithOffset.y =
          firstPoint.orientation[1] * firstOffset + firstPoint.y;
        pathData.push(
          new SVGPathSegment("L", [
            firstPointWithOffset.x,
            firstPointWithOffset.y
          ])
        );
        points[0] = firstPointWithOffset;
      }

      if (
        !!markerEnd &&
        lastPoint.orientation &&
        typeof lastPoint.orientation[0] !== "undefined" &&
        typeof lastPoint.orientation[1] !== "undefined"
      ) {
        lastSegment.push(new SVGPathSegment("L", [lastPoint.x, lastPoint.y]));

        var lastPointWithOffset: any = {};
        var lastOffset;
        var lastMarkerData = { x: 0, y: 0, markerWidth: 12, markerHeight: 12 };
        if (!!lastMarkerData) {
          lastOffset = markerHeightFactor * lastMarkerData.markerHeight;
        } else {
          lastOffset = 12;
        }
        lastPointWithOffset.x =
          lastPoint.orientation[0] * lastOffset + lastPoint.x;
        lastPointWithOffset.y =
          lastPoint.orientation[1] * lastOffset + lastPoint.y;
        elbowPoints[elbowPointCount - 1] = lastPoint = lastPointWithOffset;
      }

      elbowPoints.forEach(function(elbowPoint, index) {
        var x0, y0, x1, y1;
        if (index > 0 && index < elbowPointCount) {
          x0 =
            Math.abs(direction[0]) *
              (elbowPoints[index].x - elbowPoints[index - 1].x) +
            elbowPoints[index - 1].x;
          y0 =
            Math.abs(direction[1]) *
              (elbowPoints[index].y - elbowPoints[index - 1].y) +
            elbowPoints[index - 1].y;
          points.push({ x: x0, y: y0 });
          direction = changeDirection(direction);
        }
      });
      points.push(lastPoint);

      var i = 1,
        n = points.length,
        pi = points[0],
        x0 = pi.x,
        y0 = pi.y,
        px = [x0, x0, x0, (pi = points[1]).x],
        py = [y0, y0, y0, pi.y];
      pathData.push(
        new SVGPathSegment("L", [
          d3_svg_lineDot4(d3_svg_lineBasisBezier3, px),
          d3_svg_lineDot4(d3_svg_lineBasisBezier3, py)
        ])
      );
      points.push(points[n - 1]);
      while (++i <= n) {
        pi = points[i];
        px.shift();
        px.push(pi.x);
        py.shift();
        py.push(pi.y);
        lineBasisBezier(pathData, px, py);
      }
      points.pop();
      pathData.push(new SVGPathSegment("L", [pi.x, pi.y]));
      pathData = pathData.concat(lastSegment);
      return pathData;
    });
    this.pathData = this.getPathDataFromPoints(points, markerStart, markerEnd);
    this.d = this.getPathStringFromPathData(this.pathData);
  }
}

export class ElbowLine extends SVGPath {
  constructor(points: SVGPointElement[]) {
    super(points, function getPathDataFromPoints(points) {
      function changeDirection(currentDirection) {
        var xDirection = Math.abs(Math.abs(currentDirection[0]) - 1);
        var yDirection = Math.abs(Math.abs(currentDirection[1]) - 1);
        return [xDirection, yDirection];
      }

      var pointCount = points.length;
      var firstPoint = points[0],
        lastPoint = points[pointCount - 1];

      var pathData = [new SVGPathSegment("M", [firstPoint.x, firstPoint.y])];

      var direction = [];

      if (firstPoint.orientation) {
        direction.push(firstPoint.orientation[0]);
        direction.push(firstPoint.orientation[1]);
      } else {
        console.error(points);
        throw new Error(
          "No orientation specified for elbowline edge w/ points logged above"
        );
      }

      points.forEach(function(point, index) {
        if (index > 0 && index < pointCount) {
          var x0 =
            Math.abs(direction[0]) * (points[index].x - points[index - 1].x) +
            points[index - 1].x,
            y0 =
              Math.abs(direction[1]) * (points[index].y - points[index - 1].y) +
              points[index - 1].y;
          pathData.push(new SVGPathSegment("L", [x0, y0]));
          direction = changeDirection(direction);
        }
      });

      pathData.push(new SVGPathSegment("L", [lastPoint.x, lastPoint.y]));

      return pathData;
    });
  }
}

export class SegmentedLine extends SVGPath {
  constructor(points: SVGPointElement[]) {
    super(points, function getPathDataFromPoints(points) {
      var firstPoint = points[0];

      var pathData = [new SVGPathSegment("M", [firstPoint.x, firstPoint.y])];

      points.forEach(function(point, index) {
        if (index > 0) {
          pathData.push(new SVGPathSegment("L", [point.x, point.y]));
        }
      });

      return pathData;
    });
  }
}
