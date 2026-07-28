import { array, createValchecker, isIncluding, set, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [array, isIncluding, set, string] })
const needle = 'needle'
// Three carriers, three implementations: `String.prototype.includes` with an optional
// `position`, `Array.prototype.includes` with an optional `fromIndex`, and
// `Set.prototype.has`. The `position`/`fromIndex` options only feed their carrier's own
// call, so they are inputs to these three algorithms rather than a fourth.
const fromString = v.string()
	.isIncluding(needle)
const fromArray = v.array(v.string())
	.isIncluding(needle)
const fromSet = v.set(v.string())
	.isIncluding(needle)

const items = ['hay', needle, 'stack']
const members = new Set(items)

stepBench('isIncluding', [
	{
		name: 'string-hit',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => fromString.execute('hay needle stack'),
	},
	{
		name: 'string-miss',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isIncluding:expected_including'] },
		batch: 100,
		run: () => fromString.execute('haystack'),
	},
	{
		name: 'array-hit',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => fromArray.execute(items),
	},
	{
		name: 'set-hit',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => fromSet.execute(members),
	},
])
