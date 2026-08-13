// Escapes a user-supplied search string before it's used inside a
// RegExp, so it's treated as literal text to search for — not as
// regex syntax. Without this, a search string containing regex
// metacharacters behaves unpredictably (e.g. matching far more or far
// less than intended), and a deliberately crafted pattern (nested
// quantifiers, catastrophic backtracking) can hang the server. Every
// place across this backend that builds a RegExp from raw user input
// should go through this instead of calling `new RegExp(input)` directly.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchRegex = (input, flags = 'i') => new RegExp(escapeRegex(input), flags);

module.exports = { escapeRegex, buildSearchRegex };
