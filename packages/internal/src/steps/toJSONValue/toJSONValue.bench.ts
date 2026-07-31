import { createValchecker, string, toJSONValue } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toJSONValue] })

// `string()` is the step's declared current state and costs one `typeof`, so unlike a
// structural enclosing step it does not hide the parse.
const schema = v.string()
	.toJSONValue()

// A small document rather than a single scalar: `JSON.parse` over `'42'` would measure
// almost nothing but the call.
const json = '{"id":"u-1","age":36,"tags":["a","b"]}'
const invalid = '{"id":'

stepBench('toJSONValue', [
	{
		name: 'parses',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(json),
	},
	{
		// The expensive half of this step: `JSON.parse` throwing a `SyntaxError`, caught and
		// turned into the issue. The batch is small because a thrown engine error costs
		// microseconds on its own.
		name: 'invalid-json',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toJSONValue:invalid_json'] },
		batch: 1,
		run: () => schema.execute(invalid),
	},
])
