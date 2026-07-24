import { describe, expect, it } from 'vitest'
import { v } from './default'

describe('default valchecker instance', () => {
	it('exposes all bundled steps through the public default instance', () => {
		const avatar = new File(['img'], 'avatar.png', { type: 'image/png' })
		const attachment = new Blob(['%PDF'], { type: 'application/pdf' })
		const result = v.object({
			name: v.string()
				.toTrimmed()
				.isNotEmpty(),
			age: v.looseNumber()
				.isFinite()
				.isInteger()
				.isAtLeast(0),
			count: v.string()
				.toNumber()
				.isFinite(),
			enabled: v.string()
				.toMappedBoolean({
					trueValues: ['Y'],
					falseValues: ['N'],
				}),
			createdAt: v.date()
				.isAfter(new Date('2000-01-01T00:00:00.000Z'))
				.isBefore(new Date('2100-01-01T00:00:00.000Z')),
			parsedAt: v.string()
				.toDate(),
			identifier: v.string()
				.toBigint(),
			safeIdentifier: v.bigint()
				.toSafeNumber(),
			truthy: v.string()
				.toBoolean(),
			tags: v.set(v.string()
				.toLowercase())
				.isNotEmpty()
				.isSizeAtLeast(1)
				.isSizeAtMost(3)
				.isSizeExactly(2)
				.isIncluding('ts'),
			scores: v.map({
				key: v.string()
					.toUppercase(),
				value: v.number(),
			})
				.isNotEmpty()
				.isIncludingKey('A')
				.isIncludingValue(1),
			scoreCount: v.map({
				key: v.string(),
				value: v.number(),
			})
				.toSize(),
			tagArray: v.set(v.string())
				.toArray(),
			scoreKeys: v.map({ key: v.string(), value: v.number() })
				.toKeys(),
			scoreValues: v.map({ key: v.string(), value: v.number() })
				.toValues(),
			scoreEntries: v.map({ key: v.string(), value: v.number() })
				.toEntries(),
			mappedTags: v.set(v.string())
				.toMapped(value => value.length),
			filteredTags: v.set(v.string())
				.toFiltered(value => value.length > 1),
			mappedScoreKeys: v.map({ key: v.string(), value: v.number() })
				.toMappedKeys(key => key.toUpperCase()),
			mappedScoreValues: v.map({ key: v.string(), value: v.number() })
				.toMappedValues(value => value * 2),
			event: v.variant({
				discriminator: 'type',
				variants: {
					click: v.object({ type: v.literal('click'), x: v.number(), y: v.number() }),
					keypress: v.object({ type: v.literal('keypress'), key: v.string() }),
				},
			}),
			website: v.string()
				.isUrl(),
			contactEmail: v.string()
				.isEmail(),
			token: v.string()
				.isUuid(),
			avatar: v.file()
				.isMimeType('image/*')
				.isSizeAtMost(1024),
			attachment: v.blob()
				.isMimeType(['application/pdf', 'text/*']),
			ref: v.templateLiteral(['#', v.number()]),
		})
			.execute({
				name: '  Ada  ',
				createdAt: new Date('2020-06-15T00:00:00.000Z'),
				parsedAt: '2020-06-15T00:00:00.000Z',
				age: '37',
				count: '3',
				enabled: 'Y',
				identifier: '42',
				safeIdentifier: 7n,
				truthy: 'false',
				tags: new Set(['TS', 'JS']),
				scores: new Map([['a', 1]]),
				scoreCount: new Map([['a', 1], ['b', 2]]),
				tagArray: new Set(['a', 'b']),
				scoreKeys: new Map([['a', 1], ['b', 2]]),
				scoreValues: new Map([['a', 1], ['b', 2]]),
				scoreEntries: new Map([['a', 1], ['b', 2]]),
				mappedTags: new Set(['a', 'bb']),
				filteredTags: new Set(['a', 'bb', 'ccc']),
				mappedScoreKeys: new Map([['a', 1], ['b', 2]]),
				mappedScoreValues: new Map([['a', 1], ['b', 2]]),
				event: { type: 'click', x: 1, y: 2 },
				website: 'https://example.com',
				contactEmail: 'ada@example.com',
				token: '123e4567-e89b-12d3-a456-426614174000',
				avatar,
				attachment,
				ref: '#42',
			})

		expect(result)
			.toEqual({
				value: {
					name: 'Ada',
					createdAt: new Date('2020-06-15T00:00:00.000Z'),
					parsedAt: new Date('2020-06-15T00:00:00.000Z'),
					age: 37,
					count: 3,
					enabled: true,
					identifier: 42n,
					safeIdentifier: 7,
					truthy: true,
					tags: new Set(['ts', 'js']),
					scores: new Map([['A', 1]]),
					scoreCount: 2,
					tagArray: ['a', 'b'],
					scoreKeys: ['a', 'b'],
					scoreValues: [1, 2],
					scoreEntries: [['a', 1], ['b', 2]],
					mappedTags: new Set([1, 2]),
					filteredTags: new Set(['bb', 'ccc']),
					mappedScoreKeys: new Map([['A', 1], ['B', 2]]),
					mappedScoreValues: new Map([['a', 2], ['b', 4]]),
					event: { type: 'click', x: 1, y: 2 },
					website: 'https://example.com',
					contactEmail: 'ada@example.com',
					token: '123e4567-e89b-12d3-a456-426614174000',
					avatar,
					attachment,
					ref: '#42',
				},
			})
	})
})
