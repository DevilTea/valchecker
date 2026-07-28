import { describe, expect, it } from 'vitest'
import { createValchecker, isUuid, string } from '../..'

const v = createValchecker({ steps: [string, isUuid] })

const valid = [
	'123e4567-e89b-12d3-a456-426614174000',
	'00000000-0000-0000-0000-000000000000',
	'ffffffff-ffff-ffff-ffff-ffffffffffff',
	'A987FBC9-4BED-4078-8F07-9141BA07C9F3',
	// The version nibble spans 1–8, so the RFC 9562 additions are accepted at
	// both ends of the range.
	'018f4e2b-1e2b-7c3d-b456-426614174000',
	'123e4567-e89b-82d3-9456-426614174000',
	// Every canonical variant nibble, including in upper case.
	'123e4567-e89b-12d3-B456-426614174000',
	// Case-insensitivity reaches the max UUID's literal alternative too.
	'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
]

const invalid = [
	'not-a-uuid',
	'123e4567-e89b-12d3-a456',
	'123e4567e89b12d3a456426614174000',
	'123e4567-e89b-92d3-a456-426614174000',
	'',
	// Version 0 is not one of the versions; the all-zero UUID is accepted only
	// as a literal special case, not as a version-0 UUID.
	'123e4567-e89b-02d3-a456-426614174000',
	// The variant nibble must be one of 8, 9, a, b. `c` is the reserved range.
	'123e4567-e89b-12d3-c456-426614174000',
	// The nil and max alternatives are exact strings, so a near miss of either
	// falls through to the versioned production and fails there.
	'00000000-0000-0000-0000-000000000001',
	'ffffffff-ffff-ffff-ffff-fffffffffffe',
	// Braced and URN forms are not accepted.
	'{123e4567-e89b-12d3-a456-426614174000}',
	'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
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
