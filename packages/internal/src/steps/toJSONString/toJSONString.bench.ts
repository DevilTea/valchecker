import { createValchecker, toJSONString } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [toJSONString] })
const schema = v.toJSONString()
const value = { id: 'u-1', tags: ['a', 'b'], meta: { active: true, score: 3 } }
const cyclic: Record<string, unknown> = { id: 'u-1' }
cyclic.self = cyclic

stepBench('toJSONString', [
	{
		name: 'nested-object',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(value),
	},
	{
		name: 'serialization-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toJSONString:serialization_failed'] },
		batch: 5,
		run: () => schema.execute(cyclic),
	},
])
