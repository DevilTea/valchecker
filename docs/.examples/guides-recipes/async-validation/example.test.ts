import { describe, expect, it } from 'vitest'
import { createUsernameSchema } from './example'

describe('async-validation documentation example', () => {
	it('passes the normalized username to the external service', async () => {
		const seen: string[] = []
		const schema = createUsernameSchema({
			usernameExists: async (username) => {
				seen.push(username)
				return false
			},
		})

		const result = await schema.execute('  Alice  ')
		expect(result)
			.toEqual({ value: 'alice' })
		expect(seen)
			.toEqual(['alice'])
	})

	it('turns a domain rejection into a validation issue', async () => {
		const schema = createUsernameSchema({
			usernameExists: async () => true,
		})

		const result = await schema.execute('alice')
		expect(result)
			.toHaveProperty('issues.0.message', 'Username is already taken')
	})
})
