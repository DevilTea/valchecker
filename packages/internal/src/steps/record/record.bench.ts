import { createValchecker, literal, number, record, string, transform, union } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [record, literal, number, string, transform, union] })

// The key schema selects between two whole algorithms rather than two settings of one: a
// finite key domain makes the record closed and exhaustive and never executes the key
// schema, while an open domain runs it per key and tracks transformed keys. Both get a
// success cell for that reason.
const open = v.record({ key: v.string(), value: v.number() })
const finite = v.record({ key: v.union(['a', 'b', 'c', 'd']), value: v.number() })
const collecting = v.record({ key: v.string(), value: v.number(), collectAllIssues: true })
const transformed = v.record({
	key: v.string()
		.transform((value: string) => value.toLowerCase()),
	value: v.number(),
})
const asyncSchema = v.record({
	key: v.string(),
	value: v.number()
		.transform((value: number) => Promise.resolve(value)),
})

const valid = { a: 1, b: 2, c: 3, d: 4 }
const collides = { A: 1, b: 2, a: 3 }
const twoBadValues = { a: 'x', b: 2, c: 'y' }

stepBench('record', [
	{
		name: 'open-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => open.execute(valid),
	},
	{
		name: 'finite-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => finite.execute(valid),
	},
	{
		name: 'duplicate-transformed-key',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['record:duplicate_transformed_key'] },
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
