//import * as createSVGPathCalculator from "point-at-length";
export const createSVGPathCalculator = require("point-at-length");
import { toPoints } from "svg-points";

export type Direction = [number, number];

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

export function changeDirection(currentDirection: Direction): Direction {
  var xDirection = Math.abs(Math.abs(currentDirection[0]) - 1);
  var yDirection = Math.abs(Math.abs(currentDirection[1]) - 1);
  return [xDirection, yDirection];
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

export class ElbowLine extends SVGPath {
  constructor(points: SVGPointElement[]) {
    super(points, function getPathDataFromPoints(points) {
      var pointCount = points.length;
      var firstPoint = points[0],
        lastPoint = points[pointCount - 1];

      var pathData = [new SVGPathSegment("M", [firstPoint.x, firstPoint.y])];

      var direction = [] as Direction;

      if (firstPoint.orientation) {
        direction.push(firstPoint.orientation[0]);
        direction.push(firstPoint.orientation[1]);
      } else {
        console.error("points");
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
