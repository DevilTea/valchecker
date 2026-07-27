import { asyncCallbacks, BenchmarkResource, collectionTransforms, dateBounds, mappedBooleanValues, taggedUnionTags } from '../fixtures.mjs'

const emailPattern = /^[^@\s]+@[^\s@][^\s.@]*\.[^\s@]+$/

export function createZodAdapter(z, name, version) {
	const createFields = () => ({
		id: z.string(),
		name: z.string(),
		age: z.number()
			.int()
			.min(0),
		active: z.boolean(),
		role: z.literal('admin'),
		email: z.string()
			.regex(emailPattern),
		score: z.number(),
		verified: z.boolean(),
		nickname: z.string()
			.optional(),
		attempts: z.number()
			.int()
			.min(0),
	})

	const createRecord = () => z.object({
		id: z.string(),
		value: z.number(),
		enabled: z.boolean(),
	})

	const createOptionalFields = () => ({
		id: z.string(),
		enabled: z.boolean(),
		name: z.string()
			.optional(),
		region: z.string()
			.optional(),
		retries: z.number()
			.int()
			.optional(),
		timeout: z.number()
			.optional(),
		endpoint: z.string()
			.optional(),
		cache: z.boolean()
			.optional(),
		debug: z.boolean()
			.optional(),
		owner: z.string()
			.optional(),
		team: z.string()
			.optional(),
		description: z.string()
			.optional(),
		priority: z.number()
			.optional(),
		batchSize: z.number()
			.optional(),
		parallelism: z.number()
			.optional(),
		tag: z.string()
			.optional(),
	})

	const issuePolicyFields = () => ({
		first: z.string(),
		second: z.string(),
	})

	// The twenty tagged branches, in the shared order, for both
	// `z.discriminatedUnion()` and `z.union()`. Both pins build a discriminator map
	// from the branches' literal values, so both dispatch by lookup.
	const createTaggedBranches = () => taggedUnionTags.map(tag => z.object({
		type: z.literal(tag),
		id: z.string(),
		size: z.number(),
		enabled: z.boolean(),
	}))

	// Zod 4 promoted the string formats to top-level schemas and added
	// `templateLiteral`; Zod 3 keeps the formats as string methods and has no
	// template-literal schema at all. Detect rather than branch on the version
	// string, so a future pin cannot silently keep using the older spelling.
	// Zod 4 compiles schemas to generated code unless `jitless` is configured;
	// Zod 3 has no such mode. Read the live config rather than branching on the
	// adapter name, so the jitless adapter cannot drift from its own claim.
	const generatedCode = typeof z.config === 'function' && z.config()?.jitless !== true
	const hasTopLevelFormats = typeof z.email === 'function'
	const hasTemplateLiteral = typeof z.templateLiteral === 'function'
	const hasFile = typeof z.file === 'function'

	// The formats added after `formatEmail`/`formatUuid`/`formatIsoDateTime` are
	// resolved from the live module for the same reason those three are branched:
	// the spelling moved between the pins. A format the pin does not ship at all
	// resolves to `null`, which keeps its build key off this adapter, so the
	// scenario's declared feature is what skips it rather than a `TypeError`
	// thrown from inside the build.
	const stringMethods = z.string()
	const buildStringFormat = (methodName) => {
		const schema = z.string()
		return schema[methodName]()
	}
	const resolveFormat = (name) => {
		if (typeof z[name] === 'function')
			return () => z[name]()
		if (typeof stringMethods[name] === 'function')
			return () => buildStringFormat(name)
		return null
	}
	// `date` and `time` are the two names that collide: top-level `z.date()` is a
	// `Date` schema, not an ISO string format. Zod 4 keeps the string formats in
	// the `z.iso` namespace; Zod 3 has no such namespace and keeps them as string
	// methods.
	const resolveIsoFormat = (name) => {
		if (typeof z.iso?.[name] === 'function')
			return () => z.iso[name]()
		if (typeof stringMethods[name] === 'function')
			return () => buildStringFormat(name)
		return null
	}

	const formatBuilds = {
		formatUrl: resolveFormat('url'),
		formatIp: resolveFormat('ip'),
		formatIsoDate: resolveIsoFormat('date'),
		formatIsoTime: resolveIsoFormat('time'),
		formatEmoji: resolveFormat('emoji'),
		formatBase64: resolveFormat('base64'),
		formatBase64Url: resolveFormat('base64url'),
		formatNanoid: resolveFormat('nanoid'),
		formatUlid: resolveFormat('ulid'),
		formatCuid2: resolveFormat('cuid2'),
		formatJwt: resolveFormat('jwt'),
		formatHex: resolveFormat('hex'),
		formatMac: resolveFormat('mac'),
		formatHostname: resolveFormat('hostname'),
	}
	// A format earns a feature name only where a pinned library genuinely lacks
	// it. Zod 4 has `z.ipv4()` and `z.ipv6()` but no combined address schema, so
	// `formatIp` resolves to `null` there and the combined feature is absent.
	const gatedFormatFeatures = {
		formatIp: 'combined IPv4/IPv6',
		formatBase64Url: 'base64url',
		formatJwt: 'JWT',
		formatHex: 'hex',
		formatMac: 'MAC address',
		formatHostname: 'hostname',
	}
	// `z.stringbool()` parses a boolean out of a string, which is what
	// `looseBoolean()` and `toMappedBoolean()` do; `z.coerce.boolean()` is not an
	// alternative spelling of it, because it is `Boolean()` truthiness and maps
	// `'false'` to `true`. Zod 3 ships neither, so the family is gated there.
	const hasStringBool = typeof z.stringbool === 'function'
	// Both pins have `z.coerce.bigint()`; the feature name exists because Valibot
	// has no bigint coercion that reports an issue instead of throwing.
	const hasBigintCoercion = typeof z.coerce?.bigint === 'function'
	const hasNormalize = typeof stringMethods.normalize === 'function'
	// `nonoptional()` rejects `undefined` the way `isDefined()` does. Zod 3 has no
	// such method, and neither pin has a `nonnullable()` or a non-nullish schema, so
	// `isNonNull()` and `isNonNullish()` have no Zod opponent at all — a `refine`
	// closure would be a stand-in for the built-in the other two libraries ship.
	const hasNonOptional = typeof stringMethods.nonoptional === 'function'

	const features = []
	if (hasFile)
		features.push('file')
	if (hasTemplateLiteral)
		features.push('template literal')
	if (hasStringBool)
		features.push('boolean string parsing')
	if (hasBigintCoercion)
		features.push('bigint coercion')
	if (hasNormalize)
		features.push('Unicode normalization')
	if (hasNonOptional)
		features.push('undefined rejection')
	for (const [key, feature] of Object.entries(gatedFormatFeatures)) {
		if (formatBuilds[key] !== null)
			features.push(feature)
	}
	const supportedFormatBuilds = Object.fromEntries(
		Object.entries(formatBuilds)
			.filter(([, build]) => build !== null),
	)

	return {
		name,
		version,
		capabilities: {
			issuePolicies: ['all'],
			features,
			generatedCode,
		},
		build: {
			primitive: () => z.string()
				.min(3)
				.max(32)
				.regex(/^[a-z0-9-]+$/),
			// The competitor side of `primitive-builtin` is identical to `primitive`:
			// Zod already spells the pattern check with a built-in action, so only the
			// Valchecker adapter differs for that family.
			primitiveBuiltin: () => z.string()
				.min(3)
				.max(32)
				.regex(/^[a-z0-9-]+$/),
			flatObject: () => z.object(createFields()),
			// The competitor side of `flat-object-builtin` is identical to
			// `flatObject`: these libraries already spell the email field with a
			// built-in pattern action, so only the Valchecker adapter differs.
			builtinFlatObject: () => z.object(createFields()),
			strictFlatObject: () => z.object(createFields())
				.strict(),
			nestedObject: () => z.object({
				id: z.string(),
				user: z.object({
					profile: z.object({
						name: z.string(),
						email: z.string()
							.regex(emailPattern),
						address: z.object({
							city: z.string(),
							country: z.string()
								.length(2),
							postalCode: z.string(),
						}),
					}),
					permissions: z.array(z.string()),
				}),
			}),
			recordArray: () => z.array(createRecord()),
			set: () => z.set(z.string()),
			map: () => z.map(z.string(), z.number()),
			intersection: () => z.intersection(
				z.object({ left: z.string() }),
				z.object({ right: z.number() }),
			),
			union: () => z.union([
				z.object({ type: z.literal('text'), value: z.string() }),
				z.object({ type: z.literal('count'), value: z.number() }),
				z.object({ type: z.literal('point'), x: z.number(), y: z.number() }),
				z.object({ type: z.literal('flag'), enabled: z.boolean() }),
				z.object({ type: z.literal('user'), id: z.string(), active: z.boolean() }),
			]),
			transform: () => z.string()
				.trim()
				.toLowerCase()
				.transform(value => `user:${value}`),
			optionalHeavy: () => z.object(createOptionalFields()),
			issuePolicyObject: () => z.object(issuePolicyFields()),
			issuePolicyStrictObject: () => z.object(issuePolicyFields())
				.strict(),
			issuePolicyLooseObject: () => z.object(issuePolicyFields())
				.passthrough(),
			issuePolicyArray: () => z.array(z.string()),
			issuePolicySet: () => z.set(z.string()),
			issuePolicyMap: () => z.map(z.string(), z.number()),
			issuePolicyIntersection: () => z.intersection(
				z.object({ left: z.string() }),
				z.object({ right: z.string() }),
			),
			openRecord: () => z.record(z.string(), z.number()),
			tuple: () => z.tuple([z.string(), z.number()])
				.rest(z.boolean()),
			date: () => z.date(),
			dateBounds: () => z.date()
				.min(dateBounds.lower)
				.max(dateBounds.upper),
			dateFromString: () => z.coerce.date(),
			formatEmail: () => (hasTopLevelFormats
				? z.email()
				: z.string()
						.email()),
			formatUuid: () => (hasTopLevelFormats
				? z.uuid()
				: z.string()
						.uuid()),
			formatIsoDateTime: () => (hasTopLevelFormats
				? z.iso.datetime()
				: z.string()
						.datetime()),
			membership: () => z.enum(['red', 'green', 'blue']),
			issuePolicyRecord: () => z.record(z.string(), z.number()),
			issuePolicyTuple: () => z.tuple([z.string(), z.string()]),
			// Constraint validators. Zod spells all of these as built-in schema
			// methods, so no closure appears on either side of the comparison.
			constraintAtMost: () => z.number()
				.max(100),
			constraintGreaterThan: () => z.number()
				.gt(0),
			constraintLessThan: () => z.number()
				.lt(100),
			constraintMultipleOf: () => z.number()
				.multipleOf(5),
			constraintFinite: () => z.number()
				.finite(),
			// Zod 3's `.safe()` bounds the value to the safe-integer range without
			// requiring an integer, while Zod 4's also requires one. The scenario's
			// fixtures are integers, so the two agree on them.
			constraintSafeInteger: () => z.number()
				.safe(),
			constraintNaN: () => z.nan(),
			constraintStartingWith: () => z.string()
				.startsWith('user-'),
			constraintEndingWith: () => z.string()
				.endsWith('.png'),
			constraintIncluding: () => z.string()
				.includes('@example'),
			constraintLengthExactly: () => z.string()
				.length(6),
			constraintNotEmpty: () => z.string()
				.nonempty(),
			// Zod has no `.empty()`. `.length(0)` is the same predicate `isEmpty()`
			// applies to a string — `length === 0` — and is still a built-in action
			// rather than a refinement closure.
			constraintEmpty: () => z.string()
				.length(0),
			constraintEqualTo: () => z.literal('admin'),
			constraintSizeAtLeast: () => z.set(z.string())
				.min(3),
			constraintSizeAtMost: () => z.set(z.string())
				.max(3),
			constraintSizeExactly: () => z.set(z.string())
				.size(3),
			constraintStack: () => z.string()
				.min(12)
				.max(128)
				.startsWith('avatars/')
				.endsWith('.png')
				.includes('/user-'),
			// `z.coerce.number()` performs no input type check at all: it is
			// `Number(input)` followed by the number checks, so it accepts booleans
			// and `null` that `looseNumber()` rejects. The fixtures sit inside the
			// intersection and the scenario declares `compatible-subset`.
			looseNumber: () => z.coerce.number(),
			// Zod has no conversion action, so a conversion that keeps its input type
			// check is a `transform` around the same native function the Valchecker
			// step delegates to. `z.coerce.*` would drop the type check that both
			// invalid fixtures rely on.
			convertNumber: () => z.string()
				.transform(Number),
			convertBoolean: () => z.string()
				.transform(Boolean),
			convertBigint: () => z.string()
				.transform(BigInt),
			convertString: () => z.number()
				.transform(String),
			shapeUppercase: () => z.string()
				.toUpperCase(),
			variant: () => z.discriminatedUnion('type', createTaggedBranches()),
			unionLarge: () => z.union(createTaggedBranches()),
			recursiveTree: () => {
				const tree = z.object({
					value: z.number(),
					children: z.array(z.lazy(() => tree)),
				})
				return tree
			},
			// `.catch()` also accepts a bare value; the callback form is used so the
			// three libraries pay for the same getter call.
			fallback: () => z.number()
				.min(0)
				.catch(() => 0),
			// The remaining initial schemas. Both pins spell all of these the same way,
			// so none of them is version-detected. `z.instanceof()` is a built-in in
			// both, even though Zod 3 implements it on top of `z.custom()` and therefore
			// reports a `custom` issue where Zod 4 reports an `invalid_type` — the
			// accepted set is the same `instanceof` test either way. Neither pin has a
			// blob schema, and Zod 4's `z.json()` is a recursive JSON-value schema rather
			// than the string parse check `json()` performs, so both of those scenarios
			// are gated by feature instead of built here.
			kindAny: () => z.any(),
			kindUnknown: () => z.unknown(),
			kindNever: () => z.never(),
			kindNull: () => z.null(),
			kindUndefined: () => z.undefined(),
			kindBigint: () => z.bigint(),
			kindSymbol: () => z.symbol(),
			kindInstance: () => z.instanceof(BenchmarkResource),
			// The collection transformations. Zod has no transformation action for any
			// of them, so every key here is `.transform()` around the same native call
			// the Valchecker step delegates to — which is what those scenarios'
			// `compatible-subset` scope records. The callbacks come from the shared
			// fixture, so the four adapters cannot drift apart.
			setToArray: () => z.set(z.string())
				.transform(set => [...set]),
			setToSize: () => z.set(z.string())
				.transform(set => set.size),
			mapToKeys: () => z.map(z.string(), z.number())
				.transform(map => [...map.keys()]),
			mapToValues: () => z.map(z.string(), z.number())
				.transform(map => [...map.values()]),
			mapToEntries: () => z.map(z.string(), z.number())
				.transform(map => [...map.entries()]),
			// `new Map(...)` keeps the last entry for a repeated key rather than
			// rejecting it; `toMappedKeys()` also maintains a uniqueness map and reports
			// a collision, which is the difference that scenario declares.
			mapToMappedKeys: () => z.map(z.string(), z.number())
				.transform(map => new Map(
					[...map].map(([key, value]) => [collectionTransforms.upperCaseKey(key), value]),
				)),
			mapToMappedValues: () => z.map(z.string(), z.number())
				.transform(map => new Map(
					[...map].map(([key, value]) => [key, collectionTransforms.incrementValue(value)]),
				)),
			arrayToMapped: () => z.array(z.number())
				.transform(items => items.map(collectionTransforms.double)),
			arrayToFiltered: () => z.array(z.number())
				.transform(items => items.filter(collectionTransforms.isEven)),
			arrayToSorted: () => z.array(z.number())
				.transform(items => items.toSorted(collectionTransforms.ascending)),
			arrayToSliced: () => z.array(z.number())
				.transform(items => items.slice(...collectionTransforms.sliceRange)),
			stringToSplit: () => z.string()
				.transform(text => text.split(collectionTransforms.splitSeparator)),
			stringToLength: () => z.string()
				.transform(text => text.length),
			// `JSON.parse` and `JSON.stringify` are wrapped rather than passed directly:
			// Zod calls a transform with `(value, ctx)`, and the second parameter of
			// those two functions is a reviver and a replacer. The existing
			// `.transform(Number)` keys are safe only because `Number` ignores its extra
			// arguments.
			jsonValue: () => z.string()
				.transform(text => JSON.parse(text)),
			jsonString: () => z.unknown()
				.transform(value => JSON.stringify(value)),
			// The asynchronous pipelines. In Zod asynchrony is a property of the call: an
			// async `refine`/`transform` callback makes the schema parseable only through
			// `parseAsync`/`safeParseAsync` — executed on both pins, a synchronous
			// `safeParse` of one of these throws instead of reporting an issue — so
			// `parse` below picks the async entry from the scenario's declared execution
			// mode.
			asyncCheck: () => z.string()
				.refine(asyncCallbacks.isLongEnough),
			asyncTransform: () => z.string()
				.transform(asyncCallbacks.toPrefixed),
			// Identical to `primitiveBuiltin`: Zod has no `toAsync()`, so the promise comes
			// from `safeParseAsync` over a fully synchronous schema, which is what
			// `async/wrapper-valid` compares against the Valchecker step.
			asyncWrapper: () => z.string()
				.min(3)
				.max(32)
				.regex(/^[a-z0-9-]+$/),
			// Declared only where the pinned version has them, so a scenario that
			// forgets its `requiredFeatures` fails with the harness's actionable
			// message instead of a `z.file is not a function` from inside the build.
			...supportedFormatBuilds,
			...(hasFile
				? {
						file: () => z.file(),
						fileMimeType: () => z.file()
							.mime(['image/png']),
					}
				: {}),
			...(hasTemplateLiteral
				? { templateLiteral: () => z.templateLiteral([z.number(), z.enum(['px', 'em', 'rem'])]) }
				: {}),
			...(hasStringBool
				? {
						looseBoolean: () => z.stringbool(),
						// `case: 'sensitive'` because `toMappedBoolean()` compares with
						// SameValueZero and normalizes nothing, while `stringbool()`
						// lowercases its input by default. Matching the Valchecker step is
						// the same choice the ISO-time scenario makes with
						// `isoTimeSecond()`.
						mappedBoolean: () => z.stringbool({
							truthy: mappedBooleanValues.trueValues,
							falsy: mappedBooleanValues.falseValues,
							case: 'sensitive',
						}),
					}
				: {}),
			...(hasBigintCoercion
				? { looseBigint: () => z.coerce.bigint() }
				: {}),
			...(hasNormalize
				? {
						shapeNormalized: () => z.string()
							.normalize('NFC'),
					}
				: {}),
			...(hasNonOptional
				? {
						narrowDefined: () => z.unknown()
							.nonoptional(),
					}
				: {}),
		},
		// An async scenario asks for the asynchronous entry point, which is a separate
		// method here rather than a property of the schema. Both entries return the same
		// `{ success, data }`/`{ success, error }` shape, so `normalize` is unchanged.
		parse(schema, input, context) {
			return context?.executionMode === 'async'
				? schema.safeParseAsync(input)
				: schema.safeParse(input)
		},
		normalize(result) {
			return result.success
				? { success: true, output: result.data, issueCount: 0 }
				: { success: false, issueCount: result.error.issues.length }
		},
	}
}
