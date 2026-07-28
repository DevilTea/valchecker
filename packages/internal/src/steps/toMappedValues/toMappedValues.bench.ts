import { as, createValchecker, toMappedValues } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toMappedValues] })

// `as` rather than `map({ key, value })`: the enclosing structural walk over the entries
// would be most of the unit and a `map` regression would fire here. `as` is type-only and
// installs no runtime step, so the unit is `execute()` plus this step.
const schema = v.as<Map<string, number>>()
	.toMappedValues(entryValue => entryValue * 2)
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.as<Map<string, number>>()
	.toMappedValues(() => {
		throw boom
	})

const value = new Map([['a', 1], ['b', 2], ['c', 3]])

stepBench('toMappedValues', [
	{
		name: 'mapped-values',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(value),
	},
	{
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toMappedValues:callback_failed'] },
		batch: 10,
		run: () => throwing.execute(value),
	},
])
