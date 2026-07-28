import { createValchecker, map, number, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [map, number, string, transform] })

const schema = v.map({ key: v.string(), value: v.number() })
const collecting = v.map({ key: v.string(), value: v.number(), collectAllIssues: true })
// The transformed-key bookkeeping only decides anything once two entries collapse onto
// the same key, which is this step's second owned issue.
const transformed = v.map({
	key: v.string()
		.transform((value: string) => value.toLowerCase()),
	value: v.number(),
})
const asyncSchema = v.map({
	key: v.string(),
	value: v.number()
		.transform((value: number) => Promise.resolve(value)),
})

const valid = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]])
const collides = new Map([['A', 1], ['b', 2], ['a', 3]])
const twoBadValues = new Map<string, unknown>([['a', 'x'], ['b', 2], ['c', 'y']])

stepBench('map', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		name: 'duplicate-transformed-key',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['map:duplicate_transformed_key'] },
		batch: 10,
		run: () => transformed.execute(collides),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['number:expected_number'] },
		batch: 20,
		run: () => collecting.execute(twoBadValues),
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
