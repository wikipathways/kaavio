import { compact, flatten, map } from "lodash/fp";

const NS = "kaavio";

export const formatClassNames = function(
  ...inputs: (string | string[])[]
): string {
  const classString = [
    //...map((input: string) => NS + input, compact(flatten(inputs)))
    ...map(
      (input: string) =>
        input
          //.replace(/\ /g, "_")
          .replace(/([^a-zA-Z0-9\-\_\u00A0-\uFFFF])/g, "_")
          .replace(/^(\d|\-\-|\-\d)/, "_"),
      compact(flatten(inputs))
    )
  ].join(" ");

  return classString;
};

/*
    ...map(
      (input: string) =>
        input
          .replace(/\ /g, "_")
          .replace(/([^a-zA-Z0-9\-\_\u00A0-\uFFFF])/g, "\\$1")
          .replace(/^(\d|\-\-|\-\d)/, "\\$1"),
      compact(flatten(inputs))
    )

    ...map(
      (input: string) =>
        input
          .replace(/([^a-zA-Z0-9\-\_\u00A0-\uFFFF])/g, "_")
          .replace(/^(\d|\-\-|\-\d)/, "_$1"),
      compact(flatten(inputs))
    )
//*/
