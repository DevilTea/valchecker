import { createValchecker, isJwt, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isJwt] })
const schema = v.string()
	.isJwt()

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
// A rejection that still reaches the segment checks: three non-empty segments,
// the last of which is outside the base64url alphabet. A wrong segment count
// returns before any of the step's work.
const badSignature = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.b@d'

stepBench('isJwt', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(token),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isJwt:expected_jwt'] },
		batch: 50,
		run: () => schema.execute(badSignature),
	},
])
