import { createValchecker, set, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [set, string, transform] })

const item = v.string()
const schema = v.set(item)
const collecting = v.set(item, { collectAllIssues: true })
// The transformed-item bookkeeping only decides anything once two items collapse onto
// the same output, which is this step's second owned issue.
const transformed = v.set(v.string()
	.transform((value: string) => value.toLowerCase()))
const asyncSchema = v.set(v.string()
	.transform((value: string) => Promise.resolve(value)))

const valid = new Set(['a', 'b', 'c', 'd', 'e', 'f'])
const collides = new Set(['A', 'b', 'a'])
const twoBadItems = new Set<unknown>(['a', 1, 'c', 2])

stepBench('set', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		name: 'duplicate-transformed-item',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['set:duplicate_transformed_item'] },
		batch: 10,
		run: () => transformed.execute(collides),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['string:expected_string'] },
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
