import { compact, flatten, map, uniq } from "lodash/fp";

const NS = "kaavio";

export const formatClassNames = function(
  ...inputs: (string | string[])[]
): string {
  const classString = uniq([
    ...map(
      (input: string) =>
        input
          //.replace(/\ /g, "_")
          .replace(/([^a-zA-Z0-9\-\_\u00A0-\uFFFF])/g, "_")
          .replace(/^(\d|\-\-|\-\d)/, "_"),
      compact(flatten(inputs))
    )
  ]).join(" ");

  return classString;
};
