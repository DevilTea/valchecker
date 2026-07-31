import { createValchecker, isSizeExactly, set, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isSizeExactly, set, string] })
const expectedSize = 3
const schema = v.set(v.string())
	.isSizeExactly(expectedSize)
const members = new Set(['alpha', 'beta', 'gamma'])
const fewerMembers = new Set(['alpha'])

stepBench('isSizeExactly', [
	{
		name: 'expected-size',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(members),
	},
	{
		name: 'other-size',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isSizeExactly:expected_size_exactly'] },
		batch: 50,
		run: () => schema.execute(fewerMembers),
	},
])
