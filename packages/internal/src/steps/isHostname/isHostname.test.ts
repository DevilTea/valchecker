import { describe, expect, it } from 'vitest'
import { createValchecker, isHostname, string } from '../..'

const v = createValchecker({ steps: [string, isHostname] })

const valid = [
	'example.com',
	'sub.domain.example.org',
	'localhost',
	'xn--d1acufc.xn--p1ai',
]

const invalid = [
	'-bad.com',
	'bad-.com',
	'exa mple.com',
	'a..b',
	'',
]

describe('isHostname step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isHostname()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isHostname()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isHostname:expected_hostname' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isHostname()
			.execute('-bad.com'))
			.toEqual({
				issues: [{
					code: 'isHostname:expected_hostname',
					category: 'validation',
					message: 'Expected a valid hostname.',
					path: [],
					payload: { value: '-bad.com' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isHostname({ message: 'Custom' })
			.execute('-bad.com'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
