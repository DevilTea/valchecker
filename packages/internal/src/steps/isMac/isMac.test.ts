import { describe, expect, it } from 'vitest'
import { createValchecker, isMac, string } from '../..'

const v = createValchecker({ steps: [string, isMac] })

const valid = [
	'00:1A:2B:3C:4D:5E',
	'aa-bb-cc-dd-ee-ff',
]

const invalid = [
	'00:1A:2B:3C:4D',
	'001A2B3C4D5E',
	'gg:11:22:33:44:55',
	'00:1A:2B:3C:4D:5E:6F',
	'',
]

describe('isMac step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isMac()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isMac()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isMac:expected_mac' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isMac()
			.execute('001A2B3C4D5E'))
			.toEqual({
				issues: [{
					code: 'isMac:expected_mac',
					category: 'validation',
					message: 'Expected a valid MAC address.',
					path: [],
					payload: { value: '001A2B3C4D5E' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isMac({ message: 'Custom' })
			.execute('001A2B3C4D5E'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
