import { compact, flatten, map } from "lodash/fp";

const NS = "kaavio";

export const formatClassNames = function(
  ...inputs: (string | string[])[]
): string {
  const classString = [
    ...map((input: string) => NS + input, compact(flatten(inputs)))
  ].join(" ");

  return classString;
};
