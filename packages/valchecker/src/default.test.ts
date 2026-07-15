import { describe, expect, it } from 'vitest'
import { v } from './default'

describe('default valchecker instance', () => {
	it('exposes all bundled steps through the public default instance', () => {
		const result = v.object({
			name: v.string().toTrimmed(),
			age: v.number().integer().min(0),
		}).execute({
			name: '  Ada  ',
			age: 37,
		})

		expect(result).toEqual({
			value: {
				name: 'Ada',
				age: 37,
			},
		})
	})
})
