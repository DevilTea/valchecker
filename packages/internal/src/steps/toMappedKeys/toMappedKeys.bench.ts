import { as, createValchecker, toMappedKeys } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as, toMappedKeys] })

// `as` rather than `map({ key, value })`: the enclosing structural walk over the entries
// would be most of the unit and a `map` regression would fire here. `as` is type-only and
// installs no runtime step, so the unit is `execute()` plus this step.
//
// The success cell also measures the mapped-key uniqueness bookkeeping, because
// `output.has()` and `firstKeys.set()` run for every entry on the way through. Only the
// throwing-mapper path is invisible to it, so that is the one failure cell here rather
// than one per owned code.
const schema = v.as<Map<string, number>>()
	.toMappedKeys(key => key.toUpperCase())
// Pre-allocated, because `new Error()` captures a stack and that cost belongs to V8
// rather than to this step's failure path.
const boom = new Error('boom')
const throwing = v.as<Map<string, number>>()
	.toMappedKeys(() => {
		throw boom
	})

const value = new Map([['a', 1], ['b', 2], ['c', 3]])

stepBench('toMappedKeys', [
	{
		name: 'mapped-keys',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(value),
	},
	{
		name: 'callback-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toMappedKeys:callback_failed'] },
		batch: 10,
		run: () => throwing.execute(value),
	},
])
