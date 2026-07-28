import { createValchecker, json, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [json, string] })

const schema = v.string()
	.json()

const valid = '{"id":"u-1","name":"Ada","age":36,"active":true}'
// The failure path is `JSON.parse` throwing and this step catching, which costs an order
// of magnitude more than the parse it replaces — hence the much smaller batch.
const invalid = '{"id":"u-1","name":'

stepBench('json', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(valid),
	},
	{
		name: 'invalid-json',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['json:invalid_json'] },
		batch: 5,
		run: () => schema.execute(invalid),
	},
])
