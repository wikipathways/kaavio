import * as React from "react";
import * as ReactDOM from "react-dom";

// TODO groupChildren were originally drawn as markerStart, but markerEnd is actually used much
// more often than markerStart. So for performance and simplicity reasons, it would be better that
// the groupChildren were drawn for markerEnd. When we redraw them, we can get rid of the extra g
// element and its transform for each markerDrawer below.

// NOTE: All markers put the groupChildren (visible marker contents) inside a group g element.
// Draw the groupChildren for markerEnd. If a marker is markerStart, Kaavio will rotate it 180deg.
export function Arrow(fill, stroke) {
  const markerWidth = 12;
  const markerHeight = 12;
  return {
    markerAttributes: {
      markerWidth: markerWidth,
      markerHeight: markerHeight
    },
    groupChildren: [
      <g
        key="Arrow"
        transform={`rotate(180, ${markerWidth / 2}, ${markerHeight / 2})`}
      >
        <rect x="0" y="5.4" width="2" height="1.2" stroke={fill} fill={fill} />
        <polygon points="12,11 0,6 12,1" strokeWidth="0" fill={stroke} />
      </g>
    ]
  };
}
export function TBar(fill, stroke) {
  const markerWidth = 10;
  const markerHeight = 20;
  return {
    markerAttributes: {
      markerWidth: markerWidth,
      markerHeight: markerHeight
    },
    groupChildren: [
      <g
        key="TBar"
        transform={`rotate(180, ${markerWidth / 2}, ${markerHeight / 2})`}
      >
        <rect x="0" y="9" width="8" height="2" fill={fill} />
        <line
          x="0"
          y="0"
          width="12"
          height="12"
          stroke={stroke}
          strokeWidth="1.8"
          x1="7"
          y1="0"
          x2="7"
          y2="20"
        />
      </g>
    ]
  };
}
