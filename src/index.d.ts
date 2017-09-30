// Type definitions for Kaavio
// Project: Kaavio
// Definitions by: Anders Riutta
//import { Opts } from "./src/wrappers/vanilla";
export as namespace Kaavio;

export = Kaavio;

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
