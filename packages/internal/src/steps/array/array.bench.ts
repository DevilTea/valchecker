import { array, createValchecker, number, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [array, number, transform] })

// A real element schema rather than `v.any()`, which is what these cells used to
// measure: with `any` no element can fail, so the element loop had no failing branch to
// reach and the only failure a cell could produce came from `array` itself.
const items = v.number()
const schema = v.array(items)
const collecting = v.array(items, { collectAllIssues: true })
// A promise-returning child is what makes traversal take `continueAsync`, a second loop
// this file is the only thing that can measure — the structures duplicate it per file
// deliberately, so nothing else covers this one.
const asyncSchema = v.array(v.number()
	.transform((value: number) => Promise.resolve(value)))

const valid = [1, 2, 3, 4, 5, 6]
const notAnArray = '[1, 2, 3]'
const twoBadItems = [1, 'x', 3, 'y']

stepBench('array', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		// The guard is the only issue `array` owns, so it is the only failure cell that
		// measures this step rather than its element schema.
		name: 'expected-array',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['array:expected_array'] },
		batch: 20,
		run: () => schema.execute(notAnArray),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['number:expected_number'] },
		batch: 10,
		run: () => collecting.execute(twoBadItems),
	},
	{
		name: 'async-valid',
		group: 'warm/async/success',
		async: true,
		expect: { success: true },
		batch: 2,
		run: () => asyncSchema.execute(valid),
	},
])
