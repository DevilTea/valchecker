import process from 'node:process'
import { BenchmarkResource, collectionTransforms, dateBounds, mappedBooleanValues, taggedUnionTags } from '../fixtures.mjs'

const defaultValcheckerUrl = new URL('../../../packages/valchecker/dist/index.mjs', import.meta.url).href
const valcheckerUrl = process.env.VALCHECKER_DIST_URL || defaultValcheckerUrl
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const { v } = await import(valcheckerUrl)

const emailPattern = /^[^@\s]+@[^\s@][^\s.@]*\.[^\s@]+$/

function createFields() {
	return {
		id: v.string(),
		name: v.string(),
		age: v.number()
			.isInteger()
			.isAtLeast(0),
		active: v.boolean(),
		role: v.literal('admin'),
		email: v.string()
			.check(value => emailPattern.test(value)),
		score: v.number(),
		verified: v.boolean(),
		nickname: [v.string()],
		attempts: v.number()
			.isInteger()
			.isAtLeast(0),
	}
}

// Same accept/reject set as `createFields`: only the email field changes, from a
// `check()` closure to the `isMatching` pattern validator that shipped later.
// `isEmail` is deliberately not used here, because its accepted set differs from
// the shared `emailPattern`.
function createBuiltinFields() {
	return {
		...createFields(),
		email: v.string()
			.isMatching(emailPattern),
	}
}

function createOptionalFields() {
	return {
		id: v.string(),
		enabled: v.boolean(),
		name: [v.string()],
		region: [v.string()],
		retries: [v.number()
			.isInteger()],
		timeout: [v.number()],
		endpoint: [v.string()],
		cache: [v.boolean()],
		debug: [v.boolean()],
		owner: [v.string()],
		team: [v.string()],
		description: [v.string()],
		priority: [v.number()],
		batchSize: [v.number()],
		parallelism: [v.number()],
		tag: [v.string()],
	}
}

function issuePolicyFields() {
	return {
		first: v.string(),
		second: v.string(),
	}
}

// The twenty tagged branches behind `variant/*` and `union-large/*`. One shape
// for every branch on purpose: the only thing separating an early hit from a
// late one is then the dispatch, which is what those scenarios measure. The
// five-branch `union` above keeps the varied-payload framing.
function createTaggedBranches() {
	return Object.fromEntries(taggedUnionTags.map(tag => [tag, v.object({
		type: v.literal(tag),
		id: v.string(),
		size: v.number(),
		enabled: v.boolean(),
	})]))
}

function structuralOptions(context) {
	return context?.issuePolicy === 'all'
		? { collectAllIssues: true }
		: undefined
}

function mapOptions(context, key, value) {
	return context?.issuePolicy === 'all'
		? { key, value, collectAllIssues: true }
		: { key, value }
}

export default {
	name: 'Valchecker',
	version: 'workspace',
	capabilities: {
		issuePolicies: ['first', 'all'],
		generatedCode: false,
		features: [
			'file',
			'template literal',
			'combined IPv4/IPv6',
			'base64url',
			'JWT',
			'hex',
			'MAC address',
			'hostname',
			'boolean string parsing',
			'bigint coercion',
			'one-sided trim',
			'Unicode normalization',
			'undefined rejection',
			'null rejection',
			'nullish rejection',
			// Separate from `file`: Zod 4 has `z.file()` but no blob schema, so a
			// scenario gated on `file` would ask it for a build key it cannot provide.
			'Blob',
			// `json()` checks that a string parses. Zod 4's `z.json()` is a recursive
			// JSON-value schema instead, which is a different comparison; see
			// `scenarios/schema-kind.mjs`.
			'JSON string validation',
			// `toJSONValue()` and `toJSONString()` report a parse or serialization
			// failure as an issue. Valibot's `parseJson()`/`stringifyJson()` do too;
			// Zod's only spelling is a `transform` callback, and a throw inside one
			// escapes `safeParse`.
			'JSON conversion failure reporting',
		],
	},
	build: {
		primitive: () => v.string()
			.isLengthAtLeast(3)
			.isLengthAtMost(32)
			.check(value => /^[a-z0-9-]+$/.test(value)),
		// Same accept/reject set as `primitive`, with the closure replaced by the
		// `isMatching` pattern validator the competitors were always spelled with
		// (`.regex(...)` and `v.regex(...)`). The pattern stays an inline literal
		// exactly as in `primitive` above, so the two Valchecker spellings differ in
		// nothing but the final step.
		primitiveBuiltin: () => v.string()
			.isLengthAtLeast(3)
			.isLengthAtMost(32)
			.isMatching(/^[a-z0-9-]+$/),
		flatObject: () => v.object(createFields()),
		builtinFlatObject: () => v.object(createBuiltinFields()),
		strictFlatObject: () => v.strictObject(createFields()),
		nestedObject: () => v.object({
			id: v.string(),
			user: v.object({
				profile: v.object({
					name: v.string(),
					email: v.string()
						.check(value => emailPattern.test(value)),
					address: v.object({
						city: v.string(),
						country: v.string()
							.check(value => value.length === 2),
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
		map: () => v.map({ key: v.string(), value: v.number() }),
		intersection: () => v.intersection([
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
		transform: () => v.string()
			.toTrimmed()
			.toLowercase()
			.transform(value => `user:${value}`),
		optionalHeavy: () => v.object(createOptionalFields()),
		issuePolicyObject: context => v.object(issuePolicyFields(), structuralOptions(context)),
		issuePolicyStrictObject: context => v.strictObject(issuePolicyFields(), structuralOptions(context)),
		issuePolicyLooseObject: context => v.looseObject(issuePolicyFields(), structuralOptions(context)),
		issuePolicyArray: context => v.array(v.string(), structuralOptions(context)),
		issuePolicySet: context => v.set(v.string(), structuralOptions(context)),
		issuePolicyMap: context => v.map(mapOptions(context, v.string(), v.number())),
		issuePolicyIntersection: context => v.intersection([
			v.object({ left: v.string() }),
			v.object({ right: v.string() }),
		], structuralOptions(context)),
		openRecord: () => v.record({ key: v.string(), value: v.number() }),
		tuple: () => v.tuple([v.string(), v.number(), '...', v.array(v.boolean())]),
		templateLiteral: () => v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])]),
		date: () => v.date(),
		dateFromString: () => v.string()
			.toDate(),
		dateBounds: () => v.date()
			.isAfter(dateBounds.lower)
			.isBefore(dateBounds.upper),
		file: () => v.file(),
		formatEmail: () => v.string()
			.isEmail(),
		formatUuid: () => v.string()
			.isUuid(),
		formatIsoDateTime: () => v.string()
			.isIsoDateTime(),
		formatUrl: () => v.string()
			.isUrl(),
		formatIp: () => v.string()
			.isIp(),
		formatIsoDate: () => v.string()
			.isIsoDate(),
		formatIsoTime: () => v.string()
			.isIsoTime(),
		formatEmoji: () => v.string()
			.isEmoji(),
		formatBase64: () => v.string()
			.isBase64(),
		formatBase64Url: () => v.string()
			.isBase64Url(),
		formatNanoid: () => v.string()
			.isNanoid(),
		formatUlid: () => v.string()
			.isUlid(),
		formatCuid2: () => v.string()
			.isCuid2(),
		formatJwt: () => v.string()
			.isJwt(),
		formatHex: () => v.string()
			.isHex(),
		formatMac: () => v.string()
			.isMac(),
		formatHostname: () => v.string()
			.isHostname(),
		fileMimeType: () => v.file()
			.isMimeType(['image/png']),
		membership: () => v.string()
			.isOneOf(['red', 'green', 'blue']),
		issuePolicyRecord: context => v.record(mapOptions(context, v.string(), v.number())),
		issuePolicyTuple: context => v.tuple([v.string(), v.string()], structuralOptions(context)),
		// One constraint validator per build key, each on the smallest schema that
		// can carry it, so a scenario measures the constraint rather than a
		// surrounding structure.
		constraintAtMost: () => v.number()
			.isAtMost(100),
		constraintGreaterThan: () => v.number()
			.isGreaterThan(0),
		constraintLessThan: () => v.number()
			.isLessThan(100),
		constraintMultipleOf: () => v.number()
			.isMultipleOf(5),
		constraintFinite: () => v.number()
			.isFinite(),
		constraintSafeInteger: () => v.number()
			.isSafeInteger(),
		// `v.number()` is a `typeof` check that admits `NaN`, which is what lets the
		// chain reach `isNaN()` at all; the competitors have a dedicated `nan()`
		// schema instead.
		constraintNaN: () => v.number()
			.isNaN(),
		constraintStartingWith: () => v.string()
			.isStartingWith('user-'),
		constraintEndingWith: () => v.string()
			.isEndingWith('.png'),
		constraintIncluding: () => v.string()
			.isIncluding('@example'),
		constraintLengthExactly: () => v.string()
			.isLengthExactly(6),
		constraintNotEmpty: () => v.string()
			.isNotEmpty(),
		constraintEmpty: () => v.string()
			.isEmpty(),
		constraintEqualTo: () => v.string()
			.isEqualTo('admin'),
		constraintSizeAtLeast: () => v.set(v.string())
			.isSizeAtLeast(3),
		constraintSizeAtMost: () => v.set(v.string())
			.isSizeAtMost(3),
		constraintSizeExactly: () => v.set(v.string())
			.isSizeExactly(3),
		// Five constraints on one field, which is what a real schema does and what
		// the single-constraint keys above cannot show.
		constraintStack: () => v.string()
			.isLengthAtLeast(12)
			.isLengthAtMost(128)
			.isStartingWith('avatars/')
			.isEndingWith('.png')
			.isIncluding('/user-'),
		// The coercing initial schemas. Each is a single step that both accepts its
		// own type and parses a string, so nothing precedes it in the chain.
		looseNumber: () => v.looseNumber(),
		looseBoolean: () => v.looseBoolean(),
		looseBigint: () => v.looseBigint(),
		// The conversion steps. A conversion has no type check of its own, so each
		// chain starts with the type check its input needs — which is also the only
		// failure `toNumber`, `toBoolean`, and `toString` have here.
		convertNumber: () => v.string()
			.toNumber(),
		convertBoolean: () => v.string()
			.toBoolean(),
		convertBigint: () => v.string()
			.toBigint(),
		convertString: () => v.number()
			.toString(),
		mappedBoolean: () => v.string()
			.toMappedBoolean(mappedBooleanValues),
		shapeUppercase: () => v.string()
			.toUppercase(),
		shapeTrimmedStart: () => v.string()
			.toTrimmedStart(),
		shapeTrimmedEnd: () => v.string()
			.toTrimmedEnd(),
		shapeNormalized: () => v.string()
			.toNormalized({ form: 'NFC' }),
		// `variant` looks the discriminator up and executes exactly one branch;
		// `unionLarge` is the same twenty branches tried in declaration order, which
		// is what makes the pair a lookup-versus-linear comparison rather than two
		// unrelated schemas.
		variant: () => v.variant({ discriminator: 'type', variants: createTaggedBranches() }),
		unionLarge: () => v.union(Object.values(createTaggedBranches())),
		// The recursive schema. `generic(factory)` resolves the self-reference on
		// every execution, which is also why the schema's mode is maybe-async even
		// though every step here completes synchronously.
		recursiveTree: () => {
			const tree = v.object({
				value: v.number(),
				children: v.array(v.generic(() => tree)),
			})
			return tree
		},
		// `fallback` takes a getter callback and nothing else. `.catch()` and
		// Valibot's `fallback()` also accept a bare value, so both competitor builds
		// pass a callback instead: the recovery paths then cost the same call.
		fallback: () => v.number()
			.isAtLeast(0)
			.fallback(() => 0),
		// Nullish narrowing. `unknown()` is the base because these steps require an
		// output that can be `undefined` or `null` in the first place.
		narrowDefined: () => v.unknown()
			.isDefined(),
		narrowNonNull: () => v.unknown()
			.isNonNull(),
		narrowNonNullish: () => v.unknown()
			.isNonNullish(),
		// The remaining initial schemas, one build key each. `any` and `unknown` add
		// no runtime check at all, which is what makes them the per-call floor, and
		// `never` fails without one, which makes it the error-construction floor.
		kindAny: () => v.any(),
		kindUnknown: () => v.unknown(),
		kindNever: () => v.never(),
		kindNull: () => v.null(),
		kindUndefined: () => v.undefined(),
		kindBigint: () => v.bigint(),
		kindSymbol: () => v.symbol(),
		kindInstance: () => v.instance(BenchmarkResource),
		kindBlob: () => v.blob(),
		// `json()` is a step on a string rather than an initial schema, so the chain
		// carries the `string()` check the step's expected state requires.
		kindJsonString: () => v.string()
			.json(),
		// The collection transformations. Each step sits on the smallest schema that
		// can carry it, so a row reads as the step rather than as its container, and
		// the five Map keys deliberately share one `map(string, number)` baseline so
		// their rows stay comparable with each other. Every callback comes from
		// `collectionTransforms`, so the competitor closures call the same function
		// objects rather than equivalent copies.
		setToArray: () => v.set(v.string())
			.toArray(),
		setToSize: () => v.set(v.string())
			.toSize(),
		mapToKeys: () => v.map({ key: v.string(), value: v.number() })
			.toKeys(),
		mapToValues: () => v.map({ key: v.string(), value: v.number() })
			.toValues(),
		mapToEntries: () => v.map({ key: v.string(), value: v.number() })
			.toEntries(),
		mapToMappedKeys: () => v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(collectionTransforms.upperCaseKey),
		mapToMappedValues: () => v.map({ key: v.string(), value: v.number() })
			.toMappedValues(collectionTransforms.incrementValue),
		arrayToMapped: () => v.array(v.number())
			.toMapped(collectionTransforms.double),
		arrayToFiltered: () => v.array(v.number())
			.toFiltered(collectionTransforms.isEven),
		// The comparator form on purpose: `toSorted()` without one delegates straight
		// to `Array.prototype.toSorted` and never installs the callback sentinel, so
		// it would measure a different step than the competitors' comparator
		// spellings.
		arrayToSorted: () => v.array(v.number())
			.toSorted({ compareFn: collectionTransforms.ascending }),
		arrayToSliced: () => v.array(v.number())
			.toSliced(...collectionTransforms.sliceRange),
		stringToSplit: () => v.string()
			.toSplit(collectionTransforms.splitSeparator),
		stringToLength: () => v.string()
			.toLength(),
		// The serialization steps. `toJSONString` accepts any current state, so
		// `unknown()` keeps the serialization work unmixed with a structural walk.
		jsonValue: () => v.string()
			.toJSONValue(),
		jsonString: () => v.unknown()
			.toJSONString(),
	},
	parse(schema, input) {
		return schema.execute(input)
	},
	normalize(result) {
		return 'value' in result
			? { success: true, output: result.value, issueCount: 0 }
			: { success: false, issueCount: result.issues.length }
	},
}
