// Type definitions for Kaavio
// Project: Kaavio
// Definitions by: Anders Riutta
//import { Opts } from "./src/wrappers/vanilla";
//export as namespace Kaavio;

//export = Kaavio;

/**
 * Interfaces for all components' props.
 *
 * Anders: is this the best way to do this? For me, this really helps documentation.
 * I'm not sure about the parent Entity inheriting the props of it's children.
 */

/*
declare module "*.css" {
  interface IClassNames {
    [className: string]: string;
  }
  const classNames: IClassNames;
  export = classNames;
}
//*/

export type GetNamespacedId = (input: string) => string;

export interface FilterProps {
  filterName: string;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  parentFill?: string;
}

export interface FilterRequestProps extends FilterProps {
  getNamespacedId: GetNamespacedId;
}

export interface LatestFilterReferenced extends FilterProps {
  fill: string;
  strokeWidth: number;
  parentFill: string;
}

export interface FilterResponseProps {
  id: string;
  filterUnits?: string;
  width?: string;
  height?: string;
  x?: string;
  y?: string;
  filterRes?: number;
}

export type FilterResponse = {
  filterProperties: FilterResponseProps;
  filterPrimitives: JSX.Element[];
};

export type GetNamespacedFilter = (filterProps: FilterProps) => FilterResponse;
export type GetNamespacedFilterId = (filterProps: FilterProps) => string;

export interface FilterDefsProps {
  pathway: Record<string, any>;
  entitiesById: Record<string, any>;
  highlights: [string, string, string][];
}

export type MarkerProperty =
  | "markerStart"
  | "markerEnd"
  | "markerMid"
  | "marker";

export type StringReferenceValue = "none" | "inherit" | "currentColor";

export type GetNamespacedMarkerId = (
  latestMarkerReferenced: LatestMarkerReferenced
) => string;

export interface MarkerComponentProps {
  getNamespacedMarkerId: GetNamespacedMarkerId;
  markerDrawerMap: Record<string, Function>;
  markerLocationType: MarkerProperty;
  markerName: StringReferenceValue & string;
}

export interface HighlightedNode {
  target: string;
  color: string; // CSS color. E.g. 'red' or '#ffff'
}

export interface EntityProps extends NodeProps {
  edges: Record<string, Function>;
  kaavioType: string; // The type of Kaavio component the Entity is mapped to
  x: number;
  y: number;
  rotation: number;
  fill: string;
  drawAs: string;
  getNamespacedFilterId: GetNamespacedFilterId;
  getNamespacedMarkerId: GetNamespacedMarkerId;
  entitiesById: any[]; // Group needs this
  type: string[]; // Anders: Why do we include this? It could be [shape, physicalComponent, Node, cellularComponent]
  textContent: string;
  textAlign?: "left" | "center" | "right";
  height: number;
  width: number;
}

export interface NodeProps {
  strokeWidth: number;
  stroke: string;
  height: number;
  id: number;
  width: number;
}

export interface LatestMarkerReferenced {
  markerProperty: string;
  markerName: string;
}

/* Declare the Kaavio function with overloads */
// TODO: Add the callback type
/*
export function Kaavio(selector: string, about: string): void
export function Kaavio(selector: string, about: string, opts: Opts): void
export function Kaavio(
  selector: string,
  about: string,
  opts: Opts,
  callback: any
): void
//*/
