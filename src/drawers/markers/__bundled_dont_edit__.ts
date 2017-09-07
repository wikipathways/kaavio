import "source-map-support/register";
export function formatAsElementId(str) {
  return str.toLowerCase().replace(/[^\w]/, "").match(/[a-zA-Z]\w*/);
}
export { arrow, tbar } from "./index";
