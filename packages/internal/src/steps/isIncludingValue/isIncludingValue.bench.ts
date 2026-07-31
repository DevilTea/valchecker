import { createValchecker, isIncludingValue, map, number, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isIncludingValue, map, number, string] })
const expectedValue = 3
const schema = v.map({ key: v.string(), value: v.number() })
	.isIncludingValue(expectedValue)
// The step walks the entry values, so the fixtures are populated and the match sits at
// the end: the miss walks the whole Map, the hit walks all but the last comparison.
const entries = new Map([['alpha', 1], ['beta', 2], ['gamma', 3]])
const otherEntries = new Map([['alpha', 1], ['beta', 2], ['gamma', 4]])

stepBench('isIncludingValue', [
	{
		name: 'value-present',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(entries),
	},
	{
		name: 'value-absent',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIncludingValue:expected_including_value'] },
		batch: 20,
		run: () => schema.execute(otherEntries),
	},
])
