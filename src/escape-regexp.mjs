// RegExp.escape landed after the Node version CI pins, so the character class stays here
// rather than being written out at each call site.
export function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
