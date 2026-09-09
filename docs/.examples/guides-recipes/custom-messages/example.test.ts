import { describe, expect, it } from 'vitest'
import { ageSchema, nameSchema } from './example'

describe('custom-message documentation example', () => {
	it('prefers an originating per-step message over the global resolver', () => {
		const result = nameSchema.execute(42)
		expect(result)
			.toHaveProperty('issues.0.message', 'Name must be text')
	})

	it('uses the global resolver when the step does not provide a message', () => {
		const result = ageSchema.execute(16)
		expect(result)
			.toHaveProperty(
				'issues.0.message',
				'Global message for isAtLeast:expected_at_least',
			)
	})
})
