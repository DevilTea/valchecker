import * as v from 'valibot'
import { dateBounds } from '../fixtures.mjs'

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

export default {
	name: 'Valibot',
	version: '1.4.2',
	capabilities: {
		issuePolicies: ['first', 'all'],
		generatedCode: false,
		// Valibot has no `jwt` or `base64url` action, and no hostname action at
		// all — `url()` is a whole-URL check, not a bare hostname one.
		features: ['file', 'combined IPv4/IPv6', 'hex', 'MAC address'],
	},
	build: {
		primitive: () => v.pipe(
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
