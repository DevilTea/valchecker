export const primitive = {
	valid: 'abc-123',
	invalidEarly: 42,
	invalidLate: 'ABC!',
}

export const flatObject = {
	valid: Object.freeze({
		id: 'user-1',
		name: 'Ada Lovelace',
		age: 37,
		active: true,
		role: 'admin',
		email: 'ada@example.com',
		score: 99.5,
		verified: true,
		nickname: 'ada',
		attempts: 3,
	}),
	invalidFirst: Object.freeze({
		id: 1,
		name: 'Ada Lovelace',
		age: 37,
		active: true,
		role: 'admin',
		email: 'ada@example.com',
		score: 99.5,
		verified: true,
		nickname: 'ada',
		attempts: 3,
	}),
	invalidLast: Object.freeze({
		id: 'user-1',
		name: 'Ada Lovelace',
		age: 37,
		active: true,
		role: 'admin',
		email: 'ada@example.com',
		score: 99.5,
		verified: true,
		nickname: 'ada',
		attempts: -1,
	}),
	extra: Object.freeze({
		id: 'user-1',
		name: 'Ada Lovelace',
		age: 37,
		active: true,
		role: 'admin',
		email: 'ada@example.com',
		score: 99.5,
		verified: true,
		nickname: 'ada',
		attempts: 3,
		unexpected: true,
	}),
}

export const flatObjectPool = Array.from({ length: 64 }, (_, index) => ({
	id: `user-${index}`,
	name: `User ${index}`,
	age: 20 + index % 50,
	active: index % 2 === 0,
	role: 'admin',
	email: `user-${index}@example.com`,
	score: index + 0.5,
	verified: index % 3 === 0,
	nickname: `user${index}`,
	attempts: index % 5,
}))

export const nestedObject = {
	valid: Object.freeze({
		id: 'request-1',
		user: {
			profile: {
				name: 'Ada Lovelace',
				email: 'ada@example.com',
				address: {
					city: 'London',
					country: 'GB',
					postalCode: 'SW1A1AA',
				},
			},
			permissions: ['read', 'write', 'admin'],
		},
	}),
	invalidDeep: Object.freeze({
		id: 'request-1',
		user: {
			profile: {
				name: 'Ada Lovelace',
				email: 'ada@example.com',
				address: {
					city: 'London',
					country: 'GB',
					postalCode: 123,
				},
			},
			permissions: ['read', 'write', 'admin'],
		},
	}),
}

export function createRecords(length, offset = 0) {
	return Array.from({ length }, (_, index) => ({
		id: `item-${offset + index}`,
		value: offset + index,
		enabled: (offset + index) % 2 === 0,
	}))
}

export function createInvalidRecords(length, invalidIndex) {
	const records = createRecords(length)
	records[invalidIndex] = {
		id: `item-${invalidIndex}`,
		value: 'invalid',
		enabled: true,
	}
	return records
}

export const recordArrayPool = Array.from({ length: 32 }, (_, index) => createRecords(10, index * 10))

export const unionInputs = {
	first: Object.freeze({ type: 'text', value: 'hello' }),
	middle: Object.freeze({ type: 'point', x: 10, y: 20 }),
	last: Object.freeze({ type: 'user', id: 'user-1', active: true }),
	invalid: Object.freeze({ type: 'unknown', value: null }),
}

export const unionFirstPool = Array.from({ length: 64 }, (_, index) => ({
	type: 'text',
	value: `value-${index}`,
}))

export const transformInputs = {
	valid: '  Alice  ',
	invalid: 42,
	output: 'user:alice',
}

export const optionalHeavy = {
	sparse: Object.freeze({ id: 'config-1', enabled: true }),
	full: Object.freeze({
		id: 'config-1',
		enabled: true,
		name: 'production',
		region: 'eu-west',
		retries: 3,
		timeout: 5000,
		endpoint: 'https://example.com',
		cache: true,
		debug: false,
		owner: 'platform',
		team: 'runtime',
		description: 'Production config',
		priority: 2,
		batchSize: 100,
		parallelism: 4,
		tag: 'stable',
	}),
	invalid: Object.freeze({ id: 'config-1', enabled: true, retries: 'three' }),
}

export const optionalSparsePool = Array.from({ length: 64 }, (_, index) => ({
	id: `config-${index}`,
	enabled: index % 2 === 0,
}))

export const collectionStructures = {
	set100: new Set(Array.from({ length: 100 }, (_, index) => `item-${index}`)),
	map100: new Map(Array.from({ length: 100 }, (_, index) => [`item-${index}`, index])),
	intersection: Object.freeze({ left: 'left', right: 1 }),
}

function createOpenRecordEntries(length, invalidKey) {
	const entries = {}
	for (let index = 0; index < length; index++)
		entries[`item-${index}`] = index
	if (invalidKey !== undefined)
		entries[invalidKey] = 'invalid'
	return entries
}

export const openRecordEntries = {
	valid100: Object.freeze(createOpenRecordEntries(100)),
	valid1000: Object.freeze(createOpenRecordEntries(1000)),
	invalidFirst: Object.freeze(createOpenRecordEntries(100, 'item-0')),
	invalidLast: Object.freeze(createOpenRecordEntries(100, 'item-99')),
}

// `[string, number, ...boolean[]]`: a fixed head plus a rest region, so the
// scenario measures per-position dispatch and variadic iteration together.
export const tupleInputs = {
	valid: Object.freeze(['head', 1, true, false, true]),
	invalidHead: Object.freeze([0, 1, true, false, true]),
	invalidRest: Object.freeze(['head', 1, true, 'invalid', true]),
	tooShort: Object.freeze(['head']),
}

// `${number}px | ${number}em | ${number}rem`.
export const templateLiteralInputs = {
	valid: '1280px',
	invalid: '1280pt',
}

// Input and expected-output Dates are distinct instances: `Object.freeze` cannot
// protect a Date's internal slot, so sharing one instance between the input and
// the expectation would make an adapter that mutated it silently self-consistent.
export const dateInputs = {
	valid: new Date('2024-03-05T08:09:10.123Z'),
	validOutput: new Date('2024-03-05T08:09:10.123Z'),
	invalidType: '2024-03-05T08:09:10.123Z',
	fromStringInput: '2024-03-05T08:09:10.123Z',
	fromStringOutput: new Date('2024-03-05T08:09:10.123Z'),
	unparseableString: 'not-a-date',
	// `date/bounds-*`: `isAfter` / `z.date().min` / `minValue`.
	lowerBound: new Date('2020-01-01T00:00:00.000Z'),
	afterBound: new Date('2024-03-05T08:09:10.123Z'),
	afterBoundOutput: new Date('2024-03-05T08:09:10.123Z'),
	beforeBound: new Date('2019-01-01T00:00:00.000Z'),
}

export const fileInputs = {
	valid: new File(['benchmark payload'], 'payload.txt', { type: 'text/plain' }),
	invalidType: 'payload.txt',
}

// Format fixtures are accepted by every adapter's implementation of the
// corresponding validator, and the invalid values are rejected by all of them,
// so a scenario compares dispatch and pattern cost rather than which library
// happens to admit an exotic edge case.
export const stringFormatInputs = {
	email: 'ada.lovelace@example.com',
	invalidEmail: 'ada.lovelace@@example',
	uuid: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
	invalidUuid: '3f333df6-90a4-4fda-8dd3',
	isoDateTime: '2024-03-05T08:09:10.123Z',
	invalidIsoDateTime: '2024-03-05 08:09:10',
}

export const membershipInputs = {
	valid: 'green',
	invalid: 'yellow',
}

export const issuePolicyRecordInput = Object.freeze({
	first: 'invalid',
	second: 'invalid',
})

export const issuePolicyTupleInput = Object.freeze([0, 1])

const invalidCollectionValues = Array.from({ length: 100 }, (_, index) => `item-${index}`)
invalidCollectionValues[0] = 0
invalidCollectionValues[99] = 99

const invalidMapEntries = Array.from({ length: 100 }, (_, index) => [`item-${index}`, index])
invalidMapEntries[0] = [0, 0]
invalidMapEntries[99] = ['item-99', 'invalid']

export const issuePolicyInputs = {
	object: Object.freeze({ first: 1, second: 2 }),
	strictObject: Object.freeze({ first: 1, second: 2, extra: true }),
	looseObject: Object.freeze({ first: 1, second: 2, extra: true }),
	array: Object.freeze([...invalidCollectionValues]),
	set: new Set(invalidCollectionValues),
	map: new Map(invalidMapEntries),
	intersection: Object.freeze({ left: 1, right: 2 }),
}
