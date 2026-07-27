/**
 * TypeScript's `${bigint}` template-literal grammar, as one definition shared by
 * `looseBigint` and by `templateLiteral`'s bigint placeholders.
 *
 * Mirrors the tsc checker's `isValidBigIntString` with `roundTripOnly` false:
 * an optional sign, then a decimal without leading zeros or a `0x`/`0b`/`0o`
 * radix literal. No numeric separators and no `n` suffix.
 *
 * Both consumers cite that same upstream rule, so this is one grammar rather
 * than two that happen to coincide: if tsc's grammar moves, both must move with
 * it, and a single definition is what makes that impossible to get half right.
 */
export const bigintLiteralPattern = /^(?:-?(?:0|[1-9]\d*)|-?0x[\da-f]+|-?0b[01]+|-?0o[0-7]+)$/i
