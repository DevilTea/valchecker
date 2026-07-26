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
	const hasTopLevelFormats = typeof z.email === 'function'
	const hasTemplateLiteral = typeof z.templateLiteral === 'function'
	const hasFile = typeof z.file === 'function'
	const features = []
	if (hasFile)
		features.push('file')
	if (hasTemplateLiteral)
		features.push('template literal')
	const dateLowerBound = new Date('2020-01-01T00:00:00.000Z')

	return {
		name,
		version,
		capabilities: {
			issuePolicies: ['all'],
			features,
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
			templateLiteral: () => z.templateLiteral([z.number(), z.enum(['px', 'em', 'rem'])]),
			date: () => z.date(),
			dateBounds: () => z.date()
				.min(dateLowerBound),
			file: () => z.file(),
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
