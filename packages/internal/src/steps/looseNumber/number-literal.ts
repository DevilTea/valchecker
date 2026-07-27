/**
 * TypeScript's `${number}` template-literal grammar, as one definition shared by
 * `looseNumber` and by `templateLiteral`'s number placeholders.
 *
 * Mirrors the tsc checker's `isValidNumberString` with `roundTripOnly` false,
 * which is `Number.isFinite(+s)` on a non-empty string rather than a pattern.
 * It therefore accepts `' 1 '`, `'   '`, `'+1'`, `'0x10'`, `'5.'` and `'1e3'`,
 * and rejects `''`, `'NaN'`, `'Infinity'`, `'1_000'` and `'1e999'`.
 *
 * Returns the parsed number so `looseNumber` can use the value it already
 * computed; `undefined` means the string is not a valid `${number}` segment.
 */
export function parseNumberLiteral(value: string): number | undefined {
	if (value === '')
		return undefined
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}
