import { boolean, createValchecker, looseObject, number, string, transform } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [boolean, looseObject, number, string, transform] })

// A non-empty shape, because `v.looseObject({})` never enters the declared-property loop
// — which is exactly what these cells used to measure. The valid input also carries an
// undeclared key, since preserving extra own properties is what distinguishes this step.
const shape = {
	id: v.string(),
	name: v.string(),
	age: v.number(),
	active: v.boolean(),
}
const schema = v.looseObject(shape)
const collecting = v.looseObject(shape, { collectAllIssues: true })
const asyncSchema = v.looseObject({
	id: v.string()
		.transform((value: string) => Promise.resolve(value)),
	name: v.string(),
	age: v.number(),
	active: v.boolean(),
})

const valid = { id: 'u-1', name: 'Ada', age: 36, active: true, extra: 'kept' }
const missingKey = { id: 'u-1', name: 'Ada', age: 36 }
const twoBadChildren = { id: 'u-1', name: 'Ada', age: 'thirty-six', active: 'yes' }

stepBench('looseObject', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		name: 'missing-key',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['looseObject:missing_key'] },
		batch: 10,
		run: () => schema.execute(missingKey),
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
