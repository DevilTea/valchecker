import { createValchecker, intersection, number, object, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [intersection, number, object, string, transform] })

// Object branches with an overlapping key are the representative case: primitive
// branches never reach the output merge at all, and disjoint flat objects take the
// shallow fast path, while a shared key pairs and merges values through the graph.
const overlapping = v.intersection([
	v.object({ shared: v.string(), left: v.string() }),
	v.object({ shared: v.string(), right: v.number() }),
])
// Two branches that agree on a key but not on its output cannot be merged, which is the
// only issue this step owns.
const conflicting = v.intersection([
	v.object({ shared: v.string() }),
	v.object({
		shared: v.string()
			.transform((value: string) => value.toUpperCase()),
	}),
])
const collecting = v.intersection([
	v.object({ left: v.string() }),
	v.object({ right: v.number() }),
], { collectAllIssues: true })
const asyncSchema = v.intersection([
	v.object({
		left: v.string()
			.transform((value: string) => Promise.resolve(value)),
	}),
	v.object({ right: v.number() }),
])

const overlappingInput = { shared: 'same', left: 'left', right: 1 }
const conflictingInput = { shared: 'same' }
const bothBranchesFail = { left: 1, right: 'x' }
const asyncInput = { left: 'left', right: 1 }

stepBench('intersection', [
	{
		name: 'merge-overlapping',
		group: 'warm/success',
		expect: { success: true },
		batch: 2,
		run: () => overlapping.execute(overlappingInput),
	},
	{
		name: 'conflicting-outputs',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['intersection:conflicting_outputs'] },
		batch: 5,
		run: () => conflicting.execute(conflictingInput),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['number:expected_number', 'string:expected_string'] },
		batch: 10,
		run: () => collecting.execute(bothBranchesFail),
	},
	{
		name: 'async-valid',
		group: 'warm/async/success',
		async: true,
		expect: { success: true },
		batch: 5,
		run: () => asyncSchema.execute(asyncInput),
	},
])
