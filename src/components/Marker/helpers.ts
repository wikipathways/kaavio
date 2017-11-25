import { getSVGReferenceType } from "../../spinoffs/formatSVGReference";
import { MarkerProperty } from "../../types";

export const MARKER_PROPERTIES: ReadonlyArray<MarkerProperty> = [
  "markerStart",
  "markerMid",
  "markerEnd",
  "marker"
];

export const getSVGMarkerReferenceType = (markerName: string) => {
  return getSVGReferenceType(markerName, ["string", "localIRI", "nonLocalIRI"]);
};
