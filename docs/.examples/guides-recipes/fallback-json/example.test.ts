import { describe, expect, it } from 'vitest'
import { payloadSchema } from './example'

describe('fallback JSON documentation example', () => {
	it('recovers invalid JSON before delegated structural validation', () => {
		expect(payloadSchema.execute('not valid JSON'))
			.toEqual({ value: { items: [] } })
	})

	it('does not let the earlier fallback conceal later object validation failures', () => {
		expect(payloadSchema.execute('{"items":[{"id":"","quantity":0}]}'))
			.toHaveProperty('issues')
	})
})
