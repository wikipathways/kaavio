export function normalizeElementId(str: string): string {
  const normalizedNameMatchResult = str
    .toLowerCase()
    .replace(/[^\w]/g, "")
    .match(/[a-zA-Z]\w*/);
  if (!normalizedNameMatchResult) {
    throw new Error(`Failed to create normalizeElementId for input "${str}"`);
  }
  return normalizedNameMatchResult[0];
}
