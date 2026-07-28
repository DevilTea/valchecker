import { createValchecker, number, object, string, use } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, object, string, use] })

const delegate = v.object({ id: v.string(), age: v.number() })
const schema = v.use(delegate)

const valid = { id: 'u-1', age: 36 }

// `use` is one delegating call and owns no issue code: it adds a step that hands the
// value to another schema's `~execute`. A failure cell would measure the delegate's
// failure path, so the success cell is the whole honest set.
stepBench('use', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(valid),
	},
])
