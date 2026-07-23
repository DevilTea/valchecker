import { describe, expect, it } from 'vitest'
import { createValchecker, string, toNormalized } from '../..'

const v = createValchecker({ steps: [string, toNormalized] })
describe('toNormalized step plugin', () => {
	it('normalizes to NFC by default and supports an explicit form', () => {
		expect(v.string()
			.toNormalized()
			.execute('e\u0301'))
			.toEqual({ value: 'é' })
		expect(v.string()
			.toNormalized({ form: 'NFD' })
			.execute('é'))
			.toEqual({ value: 'e\u0301' })
	})
	it('rejects invalid schema configuration', () => {
		expect(() => v.string()
			.toNormalized({ form: 'INVALID' as any }))
			.toThrow('form must be')
	})
})
