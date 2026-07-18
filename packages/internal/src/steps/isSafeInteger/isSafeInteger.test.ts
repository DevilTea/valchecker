import { describe, expect, it } from 'vitest'
import { createValchecker, isSafeInteger, number } from '../..'
const v = createValchecker({ steps: [isSafeInteger, number] })
describe('isSafeInteger step plugin', () => {
	it('accepts safe integers', () => expect(v.number().isSafeInteger().execute(Number.MAX_SAFE_INTEGER)).toEqual({ value: Number.MAX_SAFE_INTEGER }))
	it.each([1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, Number.NaN])('rejects %s', value => {
		expect(v.number().isSafeInteger({ message: 'Safe integer required' }).execute(value)).toMatchObject({ issues: [{ code: 'isSafeInteger:expected_safe_integer', message: 'Safe integer required', payload: { value } }] })
	})
})
