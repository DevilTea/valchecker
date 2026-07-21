import * as v from 'valibot'

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const integer = () => v.pipe(v.number(), v.integer())
const nonNegativeInteger = () => v.pipe(v.number(), v.integer(), v.minValue(0))

const createFields = () => ({
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
})

const createOptionalFields = () => ({
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
})

const issuePolicyFields = () => ({
	first: v.string(),
	second: v.string(),
})

export default {
	name: 'Valibot',
	version: '1.4.2',
	capabilities: {
		issuePolicies: ['first', 'all'],
	},
	build: {
		primitive: () => v.pipe(
			v.string(),
			v.minLength(3),
			v.maxLength(32),
			v.regex(/^[a-z0-9-]+$/),
		),
		flatObject: () => v.object(createFields()),
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
