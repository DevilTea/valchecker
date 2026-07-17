import { describe, expect, it } from 'vitest'
import { v } from './default'

describe('default valchecker instance', () => {
	it('exposes all bundled steps through the public default instance', () => {
		const result = v.object({
			name: v.string().toTrimmed().isNotEmpty(),
			age: v.looseNumber().isFinite().isInteger().isAtLeast(0),
			count: v.string().toNumber().isFinite(),
			enabled: v.string().toMappedBoolean({
				trueValues: ['Y'],
				falseValues: ['N'],
			}),
			identifier: v.string().toBigint(),
			safeIdentifier: v.bigint().toSafeNumber(),
			truthy: v.string().toBoolean(),
		}).execute({
			name: '  Ada  ',
			age: '37',
			count: '3',
			enabled: 'Y',
			identifier: '42',
			safeIdentifier: 7n,
			truthy: 'false',
		})

		expect(result).toEqual({
			value: {
				name: 'Ada',
				age: 37,
				count: 3,
				enabled: true,
				identifier: 42n,
				safeIdentifier: 7,
				truthy: true,
			},
		})
	})
})
