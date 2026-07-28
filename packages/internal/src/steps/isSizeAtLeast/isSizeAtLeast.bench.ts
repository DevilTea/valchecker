import { createValchecker, isSizeAtLeast, set, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isSizeAtLeast, set, string] })
const minimumSize = 2
const schema = v.set(v.string())
	.isSizeAtLeast(minimumSize)
// Both fixtures are populated: an empty Set would skip the base step's item loop, so the
// failure cell would measure a different pipeline from the success cell.
const members = new Set(['alpha', 'beta', 'gamma'])
const fewerMembers = new Set(['alpha'])

stepBench('isSizeAtLeast', [
	{
		name: 'large-enough',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(members),
	},
	{
		name: 'too-small',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isSizeAtLeast:expected_size_at_least'] },
		batch: 50,
		run: () => schema.execute(fewerMembers),
	},
])
