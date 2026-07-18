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
			tags: v.set(v.string().toLowercase())
				.isNotEmpty()
				.isSizeAtLeast(1)
				.isSizeAtMost(3)
				.isSizeExactly(2)
				.isIncluding('ts'),
			scores: v.map({
				key: v.string().toUppercase(),
				value: v.number(),
			})
				.isNotEmpty()
				.isIncludingKey('A')
				.isIncludingValue(1),
			scoreCount: v.map({
				key: v.string(),
				value: v.number(),
			}).toSize(),
		}).execute({
			name: '  Ada  ',
			age: '37',
			count: '3',
			enabled: 'Y',
			identifier: '42',
			safeIdentifier: 7n,
			truthy: 'false',
			tags: new Set(['TS', 'JS']),
			scores: new Map([['a', 1]]),
			scoreCount: new Map([['a', 1], ['b', 2]]),
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
				tags: new Set(['ts', 'js']),
				scores: new Map([['A', 1]]),
				scoreCount: 2,
			},
		})
	})
})
