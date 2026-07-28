import { boolean, createValchecker, number, strictObject, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [boolean, number, strictObject, string, transform] })

// A non-empty shape, because `v.strictObject({})` never enters the declared-property
// loop. The previous 'valid input - large' cell also passed 100 undeclared keys to an
// empty shape, so it produced `strictObject:unexpected_keys` — a failure recorded as a
// success.
const shape = {
	id: v.string(),
	name: v.string(),
	age: v.number(),
	active: v.boolean(),
}
const schema = v.strictObject(shape)
const collecting = v.strictObject(shape, { collectAllIssues: true })
const asyncSchema = v.strictObject({
	id: v.string()
		.transform((value: string) => Promise.resolve(value)),
	name: v.string(),
	age: v.number(),
	active: v.boolean(),
})

const valid = { id: 'u-1', name: 'Ada', age: 36, active: true }
const extraKey = { id: 'u-1', name: 'Ada', age: 36, active: true, extra: 'rejected' }
const twoBadChildren = { id: 'u-1', name: 'Ada', age: 'thirty-six', active: 'yes' }

stepBench('strictObject', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		// Rejecting undeclared keys is the one thing this step owns that `object` does not.
		name: 'unexpected-keys',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['strictObject:unexpected_keys'] },
		batch: 20,
		run: () => schema.execute(extraKey),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['boolean:expected_boolean', 'number:expected_number'] },
		batch: 10,
		run: () => collecting.execute(twoBadChildren),
	},
	{
		name: 'async-valid',
		group: 'warm/async/success',
		async: true,
		expect: { success: true },
		batch: 5,
		run: () => asyncSchema.execute(valid),
	},
])
