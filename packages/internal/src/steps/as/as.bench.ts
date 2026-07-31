import { as, createValchecker } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [as] })

// `as` is type-only: its implementation is `noop`, so it installs no runtime step and the
// schema below has an empty pipeline. This cell therefore measures `execute()` over no
// steps and nothing else — there is no runtime behaviour of `as` to measure, and no
// failure it can produce.
const schema = v.as<string>()

const value = 'value'

stepBench('as', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(value),
	},
])
