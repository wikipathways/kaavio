export function normalizeElementId(str) {
  return str.toLowerCase().replace(/[^\w]/, "").match(/[a-zA-Z]\w*/);
}
