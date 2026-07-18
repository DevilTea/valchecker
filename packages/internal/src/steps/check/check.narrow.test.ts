import { describe, expect, it } from 'vitest'
import { check, createValchecker, unknown } from '../..'

const v = createValchecker({ steps: [check, unknown] })

describe('check narrowing runtime contract', () => {
	it('treats the narrowing utility result as a successful predicate result', () => {
		const schema = v.unknown().check((value, { narrow }) => (
			typeof value === 'string' ? narrow<string>() : false
		))

		expect(schema.execute('value')).toEqual({ value: 'value' })
		expect(schema.execute(42)).toMatchObject({
			issues: [{
				code: 'check:failed',
				payload: { reason: 'returned_false', value: 42 },
			}],
		})
	})
})
