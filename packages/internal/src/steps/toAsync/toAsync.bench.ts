import { createValchecker, string, toAsync } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toAsync] })

// `toAsync` wraps the last result in `Promise.resolve` and declares the pipeline async,
// so every execution returns a promise and the cell must be awaited inside the timed
// region. It owns no issue code, so there is no failure of its own to measure.
const schema = v.string()
	.toAsync()

const valid = 'hello'

stepBench('toAsync', [
	{
		name: 'valid',
		group: 'warm/async/success',
		async: true,
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
])
