import { getSVGReferenceType } from "../../spinoffs/formatSVGReference";

export const MARKER_PROPERTIES: ReadonlyArray<MarkerProperty> = [
  "markerStart",
  "markerMid",
  "markerEnd",
  "marker"
];

export const getSVGMarkerReferenceType = (markerName: string) => {
  return getSVGReferenceType(markerName, ["string", "localIRI", "nonLocalIRI"]);
};
