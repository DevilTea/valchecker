import { describe, expect, it } from 'vitest'
import { createValchecker, isUuid, string } from '../..'

const v = createValchecker({ steps: [string, isUuid] })

const valid = [
	'123e4567-e89b-12d3-a456-426614174000',
	'00000000-0000-0000-0000-000000000000',
	'ffffffff-ffff-ffff-ffff-ffffffffffff',
	'A987FBC9-4BED-4078-8F07-9141BA07C9F3',
]

const invalid = [
	'not-a-uuid',
	'123e4567-e89b-12d3-a456',
	'123e4567e89b12d3a456426614174000',
	'123e4567-e89b-92d3-a456-426614174000',
	'',
]

describe('isUuid step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isUuid()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isUuid()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isUuid:expected_uuid' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isUuid()
			.execute('not-a-uuid'))
			.toEqual({
				issues: [{
					code: 'isUuid:expected_uuid',
					category: 'validation',
					message: 'Expected a valid UUID.',
					path: [],
					payload: { value: 'not-a-uuid' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isUuid({ message: 'Custom' })
			.execute('not-a-uuid'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
