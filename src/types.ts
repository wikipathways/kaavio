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
 *
 * TODO: the logic for icons and highlightedNodes is duplicated in Diagram and Group. Fix this.
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
  color: string;
  filterName: string;
  backgroundColor?: string;
  borderWidth?: number;
  parentBackgroundColor?: string;
}

export interface FilterRequestProps extends FilterProps {
  getNamespacedId: GetNamespacedId;
}

export interface LatestFilterReferenced extends FilterProps {
  backgroundColor: string;
  borderWidth: number;
  parentBackgroundColor: string;
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
  entityMap: Record<string, any>;
  getNamespacedFilter: GetNamespacedFilter;
  highlightedEntities: Record<string, any>;
  latestFilterReferenced: LatestFilterReferenced;
}

export interface MarkerDefsProps {
  entityMap: Record<string, any>;
  getNamespacedMarkerId: GetNamespacedMarkerId;
  latestMarkerReferenced: LatestMarkerReferenced;
  markerDrawerMap: Record<string, Function>;
  pathway: Record<string, any>;
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
  edgeDrawerMap: Record<string, Function>;
  kaavioType: string; // The type of Kaavio component the Entity is mapped to
  x: number;
  y: number;
  rotation: number;
  backgroundColor: string;
  isHighlighted: boolean;
  highlightedColor?: string;
  customClass?: string;
  drawAs: string;
  highlightedNodes: HighlightedNode[]; // The entity needs this because Groups need it
  getNamespacedFilterId: GetNamespacedFilterId;
  getNamespacedMarkerId: GetNamespacedMarkerId;
  entityMap: any[]; // Group needs this
  type: string[]; // Anders: Why do we include this? It could be [shape, physicalComponent, Node, cellularComponent]
  textContent: string;
  textAlign?: "left" | "center" | "right";
  height: number;
  width: number;
}

export interface NodeProps {
  borderWidth: number;
  color: string; // Used for borders
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
