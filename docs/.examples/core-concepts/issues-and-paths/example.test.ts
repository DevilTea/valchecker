import { describe, expect, it } from 'vitest'
import { nestedFailure, unionFailure } from './example'

describe('issues and paths documentation example', () => {
	it('maps a nested child issue to the failing data path', () => {
		expect(nestedFailure)
			.toHaveProperty('issues.0.path', ['user', 'profile', 'email'])
	})

	it('keeps union branch provenance in context instead of the data path', () => {
		expect(unionFailure)
			.toMatchObject({
				issues: [
					{
						path: [],
						context: [{ type: 'union', branchIndex: 0 }],
					},
					{
						path: [],
						context: [{ type: 'union', branchIndex: 1 }],
					},
				],
			})
	})
})
