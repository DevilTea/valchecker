import { describe, expect, it } from 'vitest'
import { transformationResult, validationResult } from './example'

describe('validation and transformation documentation example', () => {
	it('keeps a successful value unchanged when only validating', () => {
		expect(validationResult)
			.toEqual({ value: '  Alice  ' })
	})

	it('uses the transformed value for later validation and output', () => {
		expect(transformationResult)
			.toEqual({ value: 'Alice' })
	})
})
