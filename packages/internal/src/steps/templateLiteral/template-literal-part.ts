// Internal helpers for the `templateLiteral` step. NOT barrel-exported: the
// marker and descriptor are a construction-time coordination channel between
// participating initial-schema steps and `templateLiteral`, not public API.
// (Precedent: `null.ts` imports `union-shorthand` by direct relative path.)

/**
 * Construction-time metadata key. A participating initial schema attaches a
 * `TemplateLiteralPartDescriptor` under this symbol via `utils.setMetadata`, so
 * `templateLiteral` can recognize `v.number()`, `v.union([...])`, a nested
 * `templateLiteral`, etc. as a usable part.
 */
/* @__NO_SIDE_EFFECTS__ */
export const templateLiteralPartMarker = Symbol.for('valchecker:templateLiteralPartMarker')

/** Interpolatable literal value carried by a `literal` descriptor. */
export type TemplateLiteralLiteralValue = string | number | bigint | boolean | null | undefined

/**
 * Structural description of a template-literal part, mirroring the TypeScript
 * template-literal type kinds that reach the checker's matcher.
 */
export type TemplateLiteralPartDescriptor
	= | { readonly kind: 'string' }
		| { readonly kind: 'number' }
		| { readonly kind: 'bigint' }
		| { readonly kind: 'literal', readonly value: TemplateLiteralLiteralValue }
		| { readonly kind: 'union', readonly members: readonly TemplateLiteralPartDescriptor[] }
		| { readonly kind: 'template', readonly parts: readonly TemplateLiteralPartDescriptor[] }

/** Placeholder kinds that survive expansion as an open (non-literal) slot. */
type PlaceholderKind = 'string' | 'number' | 'bigint'

/**
 * An expanded template-literal member. Invariant: `texts.length === kinds.length + 1`.
 * A fully-literal member has `kinds.length === 0` and a single text.
 */
export interface TemplateLiteralMember {
	readonly texts: readonly string[]
	readonly kinds: readonly PlaceholderKind[]
}

// Eager cross-product ceiling. tsc errors with TS2590 ("union too complex")
// around 100000; we stop earlier at construction time with a clear TypeError.
// limit: eager enumeration; upgrade path is lazy per-member matching.
const MEMBER_CEILING = 10000

// Mirrors TypeScript's `${number}` grammar (`isValidNumberString(s, false)`),
// which is `Number.isFinite(+s)` on a non-empty string — NOT a regex. Accepts
// `' 1 '`, `'   '`, `'+1'`, `'0x10'`, `'5.'`, `'1e3'`; rejects `''`, `'NaN'`,
// `'Infinity'`, `'1_000'`, `'1e999'`.
function isValidNumberSegment(s: string): boolean {
	return s !== '' && Number.isFinite(Number(s))
}

// Mirrors TypeScript's `${bigint}` grammar (`isValidBigIntString(s, false)`):
// optional sign, decimal without leading zeros, or `0x`/`0b`/`0o` radix literal.
// Duplicated from `looseBigint.ts`; no numeric separators, no `n` suffix.
const BIGINT_SEGMENT_RE = /^(?:-?(?:0|[1-9]\d*)|-?0x[\da-f]+|-?0b[01]+|-?0o[0-7]+)$/i

function isValidBigintSegment(s: string): boolean {
	return BIGINT_SEGMENT_RE.test(s)
}

function isValidSegment(kind: PlaceholderKind, s: string): boolean {
	return kind === 'string'
		? true
		: kind === 'number'
			? isValidNumberSegment(s)
			: isValidBigintSegment(s)
}

/**
 * Renders a literal value into its TypeScript template-literal text, mirroring
 * the checker's `getTemplateStringForType`: strings pass through, numbers and
 * bigints use their `String()` form, and `boolean`/`null`/`undefined` use their
 * keyword text. Non-finite numbers have no TS literal type and throw.
 */
export function renderLiteralValue(value: TemplateLiteralLiteralValue, index: number): string {
	if (typeof value === 'string')
		return value
	if (typeof value === 'number') {
		if (!Number.isFinite(value))
			throw new TypeError(`templateLiteral() part at index ${index} is a non-finite number, which has no TypeScript literal type.`)
		return String(value)
	}
	if (typeof value === 'bigint')
		return String(value)
	if (value === null)
		return 'null'
	if (value === undefined)
		return 'undefined'
	// boolean
	return value ? 'true' : 'false'
}

function appendText(member: TemplateLiteralMember, text: string): TemplateLiteralMember {
	if (text === '')
		return member
	const texts = member.texts.slice()
	texts[texts.length - 1] += text
	return { texts, kinds: member.kinds }
}

function pushKind(member: TemplateLiteralMember, kind: PlaceholderKind): TemplateLiteralMember {
	return { texts: [...member.texts, ''], kinds: [...member.kinds, kind] }
}

// Folds one descriptor into the running member set, mirroring tsc's
// `getTemplateLiteralType`/`addSpans`. Literal parts extend the last text;
// open placeholders push a new span; nested templates flatten; unions fork the
// cross-product. `index` is only used for the non-finite-number error message.
function applyDescriptor(
	descriptor: TemplateLiteralPartDescriptor,
	members: readonly TemplateLiteralMember[],
	index: number,
): TemplateLiteralMember[] {
	switch (descriptor.kind) {
		case 'literal': {
			const text = renderLiteralValue(descriptor.value, index)
			return members.map(member => appendText(member, text))
		}
		case 'string':
		case 'number':
		case 'bigint':
			return members.map(member => pushKind(member, descriptor.kind))
		case 'template': {
			let current = members as TemplateLiteralMember[]
			for (const part of descriptor.parts)
				current = applyDescriptor(part, current, index)
			return current
		}
		case 'union': {
			const next: TemplateLiteralMember[] = []
			for (const member of members) {
				for (const unionMember of descriptor.members) {
					const forked = applyDescriptor(unionMember, [member], index)
					for (const forkedMember of forked)
						next.push(forkedMember)
				}
			}
			// limit: eager cross-product capped at MEMBER_CEILING.
			if (next.length > MEMBER_CEILING)
				throw new TypeError(`templateLiteral() expands to more than ${MEMBER_CEILING} members; reduce the number of union parts.`)
			return next
		}
	}
}

/**
 * Expands normalized descriptors into the full member set and applies tsc's
 * all-string reduction: a member whose every text is empty and every kind is
 * `string` collapses to a single `${string}` span, because tsc reduces such a
 * template to plain `string`.
 */
export function expandDescriptors(descriptors: readonly TemplateLiteralPartDescriptor[]): TemplateLiteralMember[] {
	let members: TemplateLiteralMember[] = [{ texts: [''], kinds: [] }]
	for (const descriptor of descriptors)
		members = applyDescriptor(descriptor, members, 0)
	return members.map(reduceMember)
}

function reduceMember(member: TemplateLiteralMember): TemplateLiteralMember {
	if (member.kinds.length === 0)
		return member
	const everyKindString = member.kinds.every(kind => kind === 'string')
	const everyTextEmpty = member.texts.every(text => text === '')
	return everyKindString && everyTextEmpty
		? { texts: ['', ''], kinds: ['string'] }
		: member
}

/**
 * Tests whether `text` matches a single expanded member, mirroring tsc's
 * `inferFromLiteralPartsToTemplateLiteral` + `isValidTypeForTemplateLiteralPlaceholder`:
 * leftmost delimiter search, the one-character rule for adjacent placeholders,
 * and no backtracking.
 */
export function matchesMember(text: string, member: TemplateLiteralMember): boolean {
	const { texts, kinds } = member
	const n = kinds.length
	if (n === 0)
		return text === texts[0]

	const startText = texts[0]!
	const endText = texts[n]!
	if (
		text.length < startText.length + endText.length
		|| !text.startsWith(startText)
		|| !text.endsWith(endText)
	) {
		return false
	}

	const body = text.slice(0, text.length - endText.length)
	let pos = startText.length
	for (let i = 0; i < n - 1; i++) {
		const delimiter = texts[i + 1]!
		let capture: string
		if (delimiter.length > 0) {
			const found = body.indexOf(delimiter, pos)
			if (found < 0)
				return false
			capture = body.slice(pos, found)
			pos = found + delimiter.length
		}
		else {
			// Adjacent placeholders: capture exactly one character (tsc `addMatch(seg, pos + 1)`).
			if (pos >= body.length)
				return false
			capture = body[pos]!
			pos += 1
		}
		if (!isValidSegment(kinds[i]!, capture))
			return false
	}
	return isValidSegment(kinds[n - 1]!, body.slice(pos))
}

// Canonical `template` rendering for issue payloads and default messages, built
// from the normalized descriptors (pre-expansion).
function renderUnionMember(descriptor: TemplateLiteralPartDescriptor): string {
	switch (descriptor.kind) {
		case 'literal':
			return typeof descriptor.value === 'string'
				? JSON.stringify(descriptor.value)
				: renderLiteralValue(descriptor.value, 0)
		case 'string':
			return 'string'
		case 'number':
			return 'number'
		case 'bigint':
			return 'bigint'
		case 'union':
			return descriptor.members.map(renderUnionMember)
				.join(' | ')
		case 'template':
			return renderPart(descriptor)
	}
}

function renderPart(descriptor: TemplateLiteralPartDescriptor): string {
	switch (descriptor.kind) {
		case 'literal':
			return renderLiteralValue(descriptor.value, 0)
		case 'string':
		case 'number':
		case 'bigint':
			return `\${${descriptor.kind}}`
		case 'union':
			return `\${${descriptor.members.map(renderUnionMember)
				.join(' | ')}}`
		case 'template':
			return descriptor.parts.map(renderPart)
				.join('')
	}
}

export function renderTemplate(descriptors: readonly TemplateLiteralPartDescriptor[]): string {
	return `\`${descriptors.map(renderPart)
		.join('')}\``
}
