import process from 'node:process'
import { dateBounds } from '../fixtures.mjs'

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
		features: ['file', 'template literal', 'combined IPv4/IPv6', 'base64url', 'JWT', 'hex', 'MAC address', 'hostname'],
	},
	build: {
		primitive: () => v.string()
			.isLengthAtLeast(3)
			.isLengthAtMost(32)
			.check(value => /^[a-z0-9-]+$/.test(value)),
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
