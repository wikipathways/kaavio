/// <reference path="../node_modules/svg-pan-zoom/dist/svg-pan-zoom.d.ts" />

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

declare type GetNamespacedId = (input: string) => string;

interface FilterProps {
  color: string;
  filterName: string;
  backgroundColor?: string;
  borderWidth?: number;
  parentBackgroundColor?: string;
}

interface FilterRequestProps extends FilterProps {
  getNamespacedId: GetNamespacedId;
}

interface LatestFilterReferenced extends FilterProps {
  backgroundColor: string;
  borderWidth: number;
  parentBackgroundColor: string;
}

interface FilterResponseProps {
  id: string;
  filterUnits?: string;
  width?: string;
  height?: string;
  x?: string;
  y?: string;
  filterRes?: number;
}

type FilterResponse = {
  filterProperties: FilterResponseProps;
  filterPrimitives: JSX.Element[];
};

declare type GetNamespacedFilter = (filterProps: FilterProps) => FilterResponse;
declare type GetNamespacedFilterId = (filterProps: FilterProps) => string;

interface FilterDefsProps {
  pathway: Record<string, any>;
  entityMap: Record<string, any>;
  getNamespacedFilter: GetNamespacedFilter;
  highlightedEntities: Record<string, any>;
  latestFilterReferenced: LatestFilterReferenced;
}

interface MarkerDefsProps {
  entityMap: Record<string, any>;
  getNamespacedMarkerId: GetNamespacedMarkerId;
  latestMarkerReferenced: LatestMarkerReferenced;
  pathway: Record<string, any>;
}

type MarkerProperty = "markerStart" | "markerEnd" | "markerMid" | "marker";

type StringReferenceValue = "none" | "inherit" | "currentColor";

declare type GetNamespacedMarkerId = (
  latestMarkerReferenced: LatestMarkerReferenced
) => string;

interface MarkerComponentProps {
  backgroundColor: string;
  color: string;
  getNamespacedMarkerId: GetNamespacedMarkerId;
  markerDrawers: Function;
  markerLocationType: MarkerProperty;
  markerName: StringReferenceValue & string;
}

interface HighlightedNode {
  target: string;
  color: string; // CSS color. E.g. 'red' or '#ffff'
}

interface EntityProps extends NodeProps {
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

interface NodeProps {
  borderWidth: number;
  color: string; // Used for borders
  height: number;
  id: number;
  width: number;
}

interface LatestMarkerReferenced {
  markerProperty: string;
  markerName: string;
  color: string;
  parentBackgroundColor: string;
}

/* Declare the Kaavio function with overloads */
// TODO: Add the callback type
declare function Kaavio(selector: string, about: string): void
/*
declare function Kaavio(selector: string, about: string, opts: Opts): void
declare function Kaavio(
  selector: string,
  about: string,
  opts: Opts,
  callback: any
): void
//*/
