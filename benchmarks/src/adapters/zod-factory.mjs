import { dateBounds } from '../fixtures.mjs'

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
	const features = []
	if (hasFile)
		features.push('file')
	if (hasTemplateLiteral)
		features.push('template literal')
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
		},
		parse(schema, input) {
			return schema.safeParse(input)
		},
		normalize(result) {
			return result.success
				? { success: true, output: result.data, issueCount: 0 }
				: { success: false, issueCount: result.error.issues.length }
		},
	}
}
