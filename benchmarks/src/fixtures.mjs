// Fixtures shared by more than one scenario family, plus `dateBounds`, which
// every adapter imports so the three date-bound schemas cannot drift apart.
// A fixture used by exactly one family lives in that family's module under
// `scenarios/`, next to the scenarios that consume it.

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

export const unionInputs = {
	first: Object.freeze({ type: 'text', value: 'hello' }),
	middle: Object.freeze({ type: 'point', x: 10, y: 20 }),
	last: Object.freeze({ type: 'user', id: 'user-1', active: true }),
	invalid: Object.freeze({ type: 'unknown', value: null }),
}

export const collectionStructures = {
	set100: new Set(Array.from({ length: 100 }, (_, index) => `item-${index}`)),
	map100: new Map(Array.from({ length: 100 }, (_, index) => [`item-${index}`, index])),
	intersection: Object.freeze({ left: 'left', right: 1 }),
}

// The single source of truth for `date/bounds-*`. Every adapter imports these so
// the three schemas cannot drift apart: `isAfter`/`isBefore`, `z.date().min/max`,
// and `minValue`/`maxValue`.
export const dateBounds = {
	lower: new Date('2020-01-01T00:00:00.000Z'),
	upper: new Date('2030-01-01T00:00:00.000Z'),
}

// The single source of truth for `variant/*` and `union-large/*`. Every adapter
// builds its twenty tagged branches from this list, in this order, so the four
// schemas cannot drift and `union-large/last` really is the same branch set
// `variant/late` dispatches into. Twenty realistic event tags: see
// `scenarios/tagged-union.mjs` for why twenty.
export const taggedUnionTags = Object.freeze([
	'text',
	'count',
	'point',
	'flag',
	'user',
	'image',
	'audio',
	'video',
	'link',
	'label',
	'range',
	'color',
	'money',
	'stamp',
	'blob',
	'geo',
	'quota',
	'score',
	'ticket',
	'session',
])

// The single source of truth for `schema-kind/instance-valid`. Every adapter
// imports this class so `v.instance(C)`, `z.instanceof(C)`, and Valibot's
// `v.instance(C)` cannot end up pointing at different prototypes. It is declared
// here rather than reusing a built-in like `Date` or `URL` so that no library can
// recognize the constructor and take a dedicated path, and it carries one own
// property so the scenario's output assertion has something to compare.
export class BenchmarkResource {
	constructor(id) {
		this.id = id
	}
}

// The single source of truth for `coercion/mapped-boolean-*`, for the same reason:
// `toMappedBoolean` and Zod 4's `stringbool` are configured from the same two
// lists, so a drift between the adapters would silently compare two mappings.
export const mappedBooleanValues = {
	trueValues: ['yes', 'y', '1'],
	falseValues: ['no', 'n', '0'],
}

// The single source of truth for `collection-transform/*`. These live here rather
// than with the family because every adapter needs them, and sharing the function
// *objects* is the point: the callback Valchecker's step invokes and the callback
// the competitor closure invokes are then the same function, so a row can only
// differ by what the library does around the call. `sliceRange` and
// `splitSeparator` are shared for the same reason `dateBounds` is — four copies of
// a literal are four chances to drift.
export const collectionTransforms = {
	double: item => item * 2,
	isEven: item => item % 2 === 0,
	ascending: (left, right) => left - right,
	upperCaseKey: key => key.toUpperCase(),
	incrementValue: value => value + 1,
	// Six of the ten items, taken from the middle so the slice is neither the whole
	// array nor empty.
	sliceRange: Object.freeze([2, 8]),
	splitSeparator: ',',
}
