import * as v from 'valibot'
import { featuresFor, issuePoliciesFor } from '../capabilities.mjs'
import { asyncCallbacks, BenchmarkResource, collectionTransforms, dateBounds, taggedUnionTags } from '../fixtures.mjs'
import { installedVersion } from './installed-version.mjs'

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
	version: installedVersion('valibot'),
	capabilities: {
		issuePolicies: issuePoliciesFor('valibot'),
		generatedCode: false,
		// Declared in `../capabilities.mjs`, with the reason each gate exists. Valibot's
		// absences, in short: no `jwt`, `base64url`, or hostname action — `url()` is a
		// whole-URL check, not a bare hostname one — no boolean-string parser, no bigint
		// coercion that reports an issue instead of throwing out of `safeParse`, and no
		// equivalent of `json()`. Its presences that Zod lacks: `nonOptional`,
		// `nonNullable`, and `nonNullish` as built-in schemas, `blob()`, and
		// `parseJson()`/`stringifyJson()` reporting a failed conversion as an issue.
		features: featuresFor('valibot'),
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
		// The competitor side of `delegation/*`. A schema is a valid `pipe()` item, so
		// a nested pipe runs the inner schema over the outer one's output, which is
		// what `use()` does; executed on the pin, it both transforms and reports the
		// inner schema's issue. The inner schema is the `primitiveBuiltin` chain, as on
		// every adapter.
		delegate: () => v.pipe(
			v.unknown(),
			v.pipe(
				v.string(),
				v.minLength(3),
				v.maxLength(32),
				v.regex(/^[a-z0-9-]+$/),
			),
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
		// Deliberately the same schema as `formatEmoji`: Valibot has no
		// registered-set mode, so the competitor side of the two emoji scenario
		// pairs is one schema measured against two Valchecker semantics.
		formatEmojiRegistered: () => v.pipe(v.string(), v.emoji()),
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
		// `toSafeNumber()`'s Valibot spelling: the native conversion piped into
		// `safeInteger()`, which is the range check Valibot already ships. Valchecker
		// range-checks the bigint and then converts; this converts and then range-checks,
		// which reaches the same decision because `Number(bigint)` rounds to a double
		// outside the safe range whenever the bigint was outside it. Verified by execution
		// against the other three adapters over the boundary values and 500,000 random
		// bigints, with zero divergence.
		safeNumber: () => v.pipe(v.bigint(), v.transform(Number), v.safeInteger()),
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
		// The remaining initial schemas. `null` and `undefined` are reserved words, so
		// Valibot exports them as `null_` and `undefined_`.
		kindAny: () => v.any(),
		kindUnknown: () => v.unknown(),
		kindNever: () => v.never(),
		kindNull: () => v.null_(),
		kindUndefined: () => v.undefined_(),
		kindBigint: () => v.bigint(),
		kindSymbol: () => v.symbol(),
		kindInstance: () => v.instance(BenchmarkResource),
		kindBlob: () => v.blob(),
		// The collection transformations. Valibot is the one competitor with real
		// built-ins for part of this family — `mapItems`, `filterItems`, and
		// `sortItems` are transformation actions, not user callbacks around a native
		// method — so those three rows are built-in against built-in. Every other key
		// here is a `v.transform` closure, because Valibot has no action for it.
		setToArray: () => v.pipe(v.set(v.string()), v.transform(set => [...set])),
		setToSize: () => v.pipe(v.set(v.string()), v.transform(set => set.size)),
		mapToKeys: () => v.pipe(v.map(v.string(), v.number()), v.transform(map => [...map.keys()])),
		mapToValues: () => v.pipe(v.map(v.string(), v.number()), v.transform(map => [...map.values()])),
		mapToEntries: () => v.pipe(v.map(v.string(), v.number()), v.transform(map => [...map.entries()])),
		// `new Map(...)` keeps the last entry for a repeated key instead of rejecting
		// it, which is the difference `collection-transform/to-mapped-keys-valid`
		// declares: `toMappedKeys()` also maintains a uniqueness map and reports a
		// collision.
		mapToMappedKeys: () => v.pipe(
			v.map(v.string(), v.number()),
			v.transform(map => new Map([...map].map(([key, value]) => [collectionTransforms.upperCaseKey(key), value]))),
		),
		mapToMappedValues: () => v.pipe(
			v.map(v.string(), v.number()),
			v.transform(map => new Map([...map].map(([key, value]) => [key, collectionTransforms.incrementValue(value)]))),
		),
		arrayToMapped: () => v.pipe(v.array(v.number()), v.mapItems(collectionTransforms.double)),
		arrayToFiltered: () => v.pipe(v.array(v.number()), v.filterItems(collectionTransforms.isEven)),
		// `sortItems` calls `Array.prototype.sort`, which mutates — but it mutates the
		// fresh array `v.array()` produced, not the benchmark's input. Verified by
		// executing this schema three times over the frozen fixture and getting the
		// same result each time; `toSorted()` is non-mutating by construction.
		arrayToSorted: () => v.pipe(v.array(v.number()), v.sortItems(collectionTransforms.ascending)),
		arrayToSliced: () => v.pipe(v.array(v.number()), v.transform(items => items.slice(...collectionTransforms.sliceRange))),
		stringToSplit: () => v.pipe(v.string(), v.transform(text => text.split(collectionTransforms.splitSeparator))),
		stringToLength: () => v.pipe(v.string(), v.transform(text => text.length)),
		// `parseJson()` and `stringifyJson()` are built-in transformation actions that
		// report the native throw as an issue, which is why Valibot participates in the
		// two invalid serialization scenarios and Zod does not.
		jsonValue: () => v.pipe(v.string(), v.parseJson()),
		jsonString: () => v.pipe(v.unknown(), v.stringifyJson()),
		// The asynchronous pipelines. Valibot splits the pipe itself: `pipeAsync` with
		// `checkAsync`/`transformAsync` is the only way to hold an async callback, and
		// such a schema must be run through `safeParseAsync`. Executed on the pin,
		// `safeParse` over one of these returns a result object built from the pending
		// promise instead of throwing, which is a silently wrong success — so the async
		// entry is not optional here, and `parse` below selects it from the scenario's
		// declared execution mode.
		asyncCheck: () => v.pipeAsync(v.string(), v.checkAsync(asyncCallbacks.isLongEnough)),
		asyncTransform: () => v.pipeAsync(v.string(), v.transformAsync(asyncCallbacks.toPrefixed)),
		// Identical to `primitiveBuiltin`: Valibot has no `toAsync()`, so the promise
		// comes from `safeParseAsync` over a fully synchronous schema.
		asyncWrapper: () => v.pipe(
			v.string(),
			v.minLength(3),
			v.maxLength(32),
			v.regex(/^[a-z0-9-]+$/),
		),
	},
	parse(schema, input, context) {
		const options = context?.issuePolicy === 'first' ? { abortEarly: true } : undefined
		return context?.executionMode === 'async'
			? v.safeParseAsync(schema, input, options)
			: v.safeParse(schema, input, options)
	},
	normalize(result) {
		return result.success
			? { success: true, output: result.output, issueCount: 0 }
			: { success: false, issueCount: result.issues.length }
	},
}
