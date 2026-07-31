import { createValchecker, isSizeAtMost, set, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isSizeAtMost, set, string] })
const maximumSize = 2
const schema = v.set(v.string())
	.isSizeAtMost(maximumSize)
const members = new Set(['alpha', 'beta'])
const moreMembers = new Set(['alpha', 'beta', 'gamma'])

stepBench('isSizeAtMost', [
	{
		name: 'small-enough',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(members),
	},
	{
		name: 'too-large',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isSizeAtMost:expected_size_at_most'] },
		batch: 50,
		run: () => schema.execute(moreMembers),
	},
])
