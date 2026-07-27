import * as v from 'valibot'
import { dateBounds, taggedUnionTags } from '../fixtures.mjs'

const emailPattern = /^[^@\s]+@[^\s@][^\s.@]*\.[^\s@]+$/
const integer = () => v.pipe(v.number(), v.integer())
const nonNegativeInteger = () => v.pipe(v.number(), v.integer(), v.minValue(0))

function createFields() {
	return {
		id: v.string(),
		name: v.string(),
		age: nonNegativeInteger(),
		active: v.boolean(),
		role: v.literal('admin'),
		email: v.pipe(v.string(), v.regex(emailPattern)),
		score: v.number(),
		verified: v.boolean(),
		nickname: v.optional(v.string()),
		attempts: nonNegativeInteger(),
	}
}

function createOptionalFields() {
	return {
		id: v.string(),
		enabled: v.boolean(),
		name: v.optional(v.string()),
		region: v.optional(v.string()),
		retries: v.optional(integer()),
		timeout: v.optional(v.number()),
		endpoint: v.optional(v.string()),
		cache: v.optional(v.boolean()),
		debug: v.optional(v.boolean()),
		owner: v.optional(v.string()),
		team: v.optional(v.string()),
		description: v.optional(v.string()),
		priority: v.optional(v.number()),
		batchSize: v.optional(v.number()),
		parallelism: v.optional(v.number()),
		tag: v.optional(v.string()),
	}
}

function issuePolicyFields() {
	return {
		first: v.string(),
		second: v.string(),
	}
}

// The twenty tagged branches, in the shared order, for both `v.variant()` and
// `v.union()`.
function createTaggedBranches() {
	return taggedUnionTags.map(tag => v.object({
		type: v.literal(tag),
		id: v.string(),
		size: v.number(),
		enabled: v.boolean(),
	}))
}

export default {
	name: 'Valibot',
	version: '1.4.2',
	capabilities: {
		issuePolicies: ['first', 'all'],
		generatedCode: false,
		// Valibot has no `jwt` or `base64url` action, and no hostname action at
		// all — `url()` is a whole-URL check, not a bare hostname one. It also has
		// no boolean-string parser, and no bigint coercion that reports an issue:
		// `v.transform(BigInt)` throws a `SyntaxError` out of `safeParse` on an
		// unparseable string, so the invalid bigint scenario cannot be expressed.
		features: [
			'file',
			'combined IPv4/IPv6',
			'hex',
			'MAC address',
			'one-sided trim',
			'Unicode normalization',
			// `nonOptional`, `nonNullable`, and `nonNullish` are all built-in schemas
			// here, which is more than either Zod pin has: Zod 4 ships `nonoptional()`
			// only and Zod 3 none of the three.
			'undefined rejection',
			'null rejection',
			'nullish rejection',
		],
	},
	build: {
		primitive: () => v.pipe(
			v.string(),
			v.minLength(3),
			v.maxLength(32),
			v.regex(/^[a-z0-9-]+$/),
		),
		// The competitor side of `primitive-builtin` is identical to `primitive`:
		// Valibot already spells the pattern check with a built-in action, so only
		// the Valchecker adapter differs for that family.
		primitiveBuiltin: () => v.pipe(
			v.string(),
			v.minLength(3),
			v.maxLength(32),
			v.regex(/^[a-z0-9-]+$/),
		),
		flatObject: () => v.object(createFields()),
		// Identical to `flatObject`: Valibot already spells the email field with a
		// built-in action, so only the Valchecker adapter differs for this family.
		builtinFlatObject: () => v.object(createFields()),
		strictFlatObject: () => v.strictObject(createFields()),
		nestedObject: () => v.object({
			id: v.string(),
			user: v.object({
				profile: v.object({
					name: v.string(),
					email: v.pipe(v.string(), v.regex(emailPattern)),
					address: v.object({
						city: v.string(),
						country: v.pipe(v.string(), v.length(2)),
						postalCode: v.string(),
					}),
				}),
				permissions: v.array(v.string()),
			}),
		}),
		recordArray: () => v.array(v.object({
			id: v.string(),
			value: v.number(),
			enabled: v.boolean(),
		})),
		set: () => v.set(v.string()),
		map: () => v.map(v.string(), v.number()),
		intersection: () => v.intersect([
			v.object({ left: v.string() }),
			v.object({ right: v.number() }),
		]),
		union: () => v.union([
			v.object({ type: v.literal('text'), value: v.string() }),
			v.object({ type: v.literal('count'), value: v.number() }),
			v.object({ type: v.literal('point'), x: v.number(), y: v.number() }),
			v.object({ type: v.literal('flag'), enabled: v.boolean() }),
			v.object({ type: v.literal('user'), id: v.string(), active: v.boolean() }),
		]),
		transform: () => v.pipe(
			v.string(),
			v.trim(),
			v.toLowerCase(),
			v.transform(value => `user:${value}`),
		),
		optionalHeavy: () => v.object(createOptionalFields()),
		issuePolicyObject: () => v.object(issuePolicyFields()),
		issuePolicyStrictObject: () => v.strictObject(issuePolicyFields()),
		issuePolicyLooseObject: () => v.looseObject(issuePolicyFields()),
		issuePolicyArray: () => v.array(v.string()),
		issuePolicySet: () => v.set(v.string()),
		issuePolicyMap: () => v.map(v.string(), v.number()),
		issuePolicyIntersection: () => v.intersect([
			v.object({ left: v.string() }),
			v.object({ right: v.string() }),
		]),
		openRecord: () => v.record(v.string(), v.number()),
		tuple: () => v.tupleWithRest([v.string(), v.number()], v.boolean()),
		date: () => v.date(),
		dateFromString: () => v.pipe(v.string(), v.toDate()),
		dateBounds: () => v.pipe(v.date(), v.minValue(dateBounds.lower), v.maxValue(dateBounds.upper)),
		file: () => v.file(),
		formatEmail: () => v.pipe(v.string(), v.email()),
		formatUuid: () => v.pipe(v.string(), v.uuid()),
		formatIsoDateTime: () => v.pipe(v.string(), v.isoTimestamp()),
		formatUrl: () => v.pipe(v.string(), v.url()),
		formatIp: () => v.pipe(v.string(), v.ip()),
		formatIsoDate: () => v.pipe(v.string(), v.isoDate()),
		// Valibot splits ISO time by granularity: `isoTime()` is `HH:MM` only,
		// while `isoTimeSecond()` requires the seconds that `isIsoTime()` also
		// requires. The second one is therefore the equivalent spelling, and the
		// scenario's fixture sits in the intersection of the two accepted sets.
		formatIsoTime: () => v.pipe(v.string(), v.isoTimeSecond()),
		formatEmoji: () => v.pipe(v.string(), v.emoji()),
		formatBase64: () => v.pipe(v.string(), v.base64()),
		formatNanoid: () => v.pipe(v.string(), v.nanoid()),
		formatUlid: () => v.pipe(v.string(), v.ulid()),
		formatCuid2: () => v.pipe(v.string(), v.cuid2()),
		formatHex: () => v.pipe(v.string(), v.hexadecimal()),
		formatMac: () => v.pipe(v.string(), v.mac()),
		fileMimeType: () => v.pipe(v.file(), v.mimeType(['image/png'])),
		membership: () => v.picklist(['red', 'green', 'blue']),
		issuePolicyRecord: () => v.record(v.string(), v.number()),
		issuePolicyTuple: () => v.tuple([v.string(), v.string()]),
		// Constraint validators, each a built-in pipe action.
		constraintAtMost: () => v.pipe(v.number(), v.maxValue(100)),
		constraintGreaterThan: () => v.pipe(v.number(), v.gtValue(0)),
		constraintLessThan: () => v.pipe(v.number(), v.ltValue(100)),
		// `multipleOf()` is an exact `%` remainder check, so it disagrees with
		// `isMultipleOf()` on decimal divisors; the scenario's divisor is 5.
		constraintMultipleOf: () => v.pipe(v.number(), v.multipleOf(5)),
		constraintFinite: () => v.pipe(v.number(), v.finite()),
		constraintSafeInteger: () => v.pipe(v.number(), v.safeInteger()),
		// `v.number()` rejects `NaN`, so the pipe spelling cannot exist here; the
		// dedicated `nan()` schema is the equivalent.
		constraintNaN: () => v.nan(),
		constraintStartingWith: () => v.pipe(v.string(), v.startsWith('user-')),
		constraintEndingWith: () => v.pipe(v.string(), v.endsWith('.png')),
		constraintIncluding: () => v.pipe(v.string(), v.includes('@example')),
		constraintLengthExactly: () => v.pipe(v.string(), v.length(6)),
		constraintNotEmpty: () => v.pipe(v.string(), v.nonEmpty()),
		constraintEmpty: () => v.pipe(v.string(), v.empty()),
		constraintEqualTo: () => v.literal('admin'),
		constraintSizeAtLeast: () => v.pipe(v.set(v.string()), v.minSize(3)),
		constraintSizeAtMost: () => v.pipe(v.set(v.string()), v.maxSize(3)),
		constraintSizeExactly: () => v.pipe(v.set(v.string()), v.size(3)),
		constraintStack: () => v.pipe(
			v.string(),
			v.minLength(12),
			v.maxLength(128),
			v.startsWith('avatars/'),
			v.endsWith('.png'),
			v.includes('/user-'),
		),
		// Valibot ships no coercing schema, so a pipe whose `transform` delegates to
		// the native conversion function is not a stand-in for a built-in — it is the
		// only spelling Valibot has. The trailing `v.number()` is what rejects the
		// `NaN` that `Number('abc')` produces: `looseNumber()` and
		// `z.coerce.number()` reject that string inside the coercion itself, so
		// without it the three would disagree on the invalid fixture. Valibot
		// therefore pays for a user callback and a second type check here, which is
		// what the scenario's `compatible-subset` scope records.
		looseNumber: () => v.pipe(v.string(), v.transform(Number), v.number()),
		// The conversion scenarios keep the input type check and stop there, because
		// the Valchecker step being measured is the bare conversion.
		convertNumber: () => v.pipe(v.string(), v.transform(Number)),
		convertBoolean: () => v.pipe(v.string(), v.transform(Boolean)),
		convertBigint: () => v.pipe(v.string(), v.transform(BigInt)),
		convertString: () => v.pipe(v.number(), v.transform(String)),
		shapeUppercase: () => v.pipe(v.string(), v.toUpperCase()),
		shapeTrimmedStart: () => v.pipe(v.string(), v.trimStart()),
		shapeTrimmedEnd: () => v.pipe(v.string(), v.trimEnd()),
		shapeNormalized: () => v.pipe(v.string(), v.normalize('NFC')),
		// `v.variant()` is the tagged-union spelling, but it dispatches by running
		// each option's discriminator schema in order until one matches rather than by
		// looking the tag up in a map. That is a real implementation difference the
		// scenarios are there to measure, not a reason to skip Valibot.
		variant: () => v.variant('type', createTaggedBranches()),
		unionLarge: () => v.union(createTaggedBranches()),
		recursiveTree: () => {
			const tree = v.object({
				value: v.number(),
				children: v.array(v.lazy(() => tree)),
			})
			return tree
		},
		// `fallback()` accepts a getter callback, matching `fallback(getValue)`.
		fallback: () => v.fallback(v.pipe(v.number(), v.minValue(0)), () => 0),
		narrowDefined: () => v.nonOptional(v.unknown()),
		narrowNonNull: () => v.nonNullable(v.unknown()),
		narrowNonNullish: () => v.nonNullish(v.unknown()),
	},
	parse(schema, input, context) {
		return v.safeParse(
			schema,
			input,
			context?.issuePolicy === 'first' ? { abortEarly: true } : undefined,
		)
	},
	normalize(result) {
		return result.success
			? { success: true, output: result.output, issueCount: 0 }
			: { success: false, issueCount: result.issues.length }
	},
}
