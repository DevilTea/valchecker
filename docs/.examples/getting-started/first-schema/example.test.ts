import { describe, expect, it } from 'vitest'
import { userResult } from './example'

describe('getting started first schema example', () => {
	it('normalizes the successful output shown in the guide', () => {
		expect(userResult)
			.toEqual({
				value: {
					name: 'Alice',
					age: 25,
				},
			})
	})
})
