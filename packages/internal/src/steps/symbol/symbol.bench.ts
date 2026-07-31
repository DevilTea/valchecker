import { createValchecker, symbol } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [symbol] })
const schema = v.symbol()
// Hoisted, because allocating a symbol inside `run` would measure the allocation rather
// than the check.
const valid = Symbol('x')

stepBench('symbol', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(valid),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['symbol:expected_symbol'] },
		batch: 100,
		run: () => schema.execute('x'),
	},
])
