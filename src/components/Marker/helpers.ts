import { getSVGReferenceType } from "../../spinoffs/formatSVGReference";
import { MarkerProperty } from "../../types";

export const MARKER_PROPERTIES: ReadonlyArray<MarkerProperty> = [
  "marker",
  "markerStart",
  "markerMid",
  "markerEnd"
];

export const createMarkerId = (
  markerProperty: MarkerProperty,
  markerName: string
) => {
  return markerProperty + markerName;
};

export const getSVGMarkerReferenceType = (markerName: string) => {
  return getSVGReferenceType(markerName, ["string", "localIRI", "nonLocalIRI"]);
};
