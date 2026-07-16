import { describe, expect, it } from 'vitest'
import { createValchecker, string, toJSONValue } from '../..'

const v = createValchecker({ steps: [string, toJSONValue] })

describe('toJSONValue step plugin', () => {
	it('parses JSON values', () => {
		expect(v.string().toJSONValue<{ value: number }>().execute('{"value":42}')).toEqual({
			value: { value: 42 },
		})
	})

	it('reports invalid JSON', () => {
		const result = v.string().toJSONValue().execute('{')
		expect(result).toMatchObject({
			issues: [{
				code: 'toJSONValue:invalid_json',
				message: 'Expected a valid JSON string.',
				path: [],
				payload: { value: '{' },
			}],
		})
		expect((result as any).issues[0].payload.error).toBeInstanceOf(SyntaxError)
	})

	it('supports custom messages', () => {
		expect(v.string().toJSONValue('Custom JSON').execute('{')).toMatchObject({
			issues: [{ message: 'Custom JSON' }],
		})
	})
})