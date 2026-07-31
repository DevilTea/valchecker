import { createValchecker, isIncludingKey, map, number, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isIncludingKey, map, number, string] })
const expectedKey = 'gamma'
const schema = v.map({ key: v.string(), value: v.number() })
	.isIncludingKey(expectedKey)
const entries = new Map([['alpha', 1], ['beta', 2], ['gamma', 3]])
const otherEntries = new Map([['alpha', 1], ['beta', 2], ['delta', 3]])

stepBench('isIncludingKey', [
	{
		name: 'key-present',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(entries),
	},
	{
		name: 'key-absent',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIncludingKey:expected_including_key'] },
		batch: 20,
		run: () => schema.execute(otherEntries),
	},
])
