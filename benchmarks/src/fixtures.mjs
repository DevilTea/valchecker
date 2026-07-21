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

const invalidCollectionValues = Array.from({ length: 100 }, (_, index) => `item-${index}`)
invalidCollectionValues[0] = 0
invalidCollectionValues[99] = 99

const invalidMapEntries = Array.from({ length: 100 }, (_, index) => [`item-${index}`, index])
invalidMapEntries[0] = [0, 'invalid']
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
