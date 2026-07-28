import { createValchecker, string, toNumber, unknown } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, toNumber, unknown] })
const fromString = v.string()
	.toNumber()
// `Number()` throws on a symbol, which is the only way to reach this step's own
// issue: the conversion delegates to `Number()` and adopts no parsing policy of its
// own, so `'invalid'` converts to `NaN` and succeeds.
const fromUnknown = v.unknown()
	.toNumber()
const unconvertible = Symbol('unconvertible')

stepBench('toNumber', [
	{
		name: 'numeric-string',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => fromString.execute('42'),
	},
	{
		name: 'conversion-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toNumber:conversion_failed'] },
		batch: 5,
		run: () => fromUnknown.execute(unconvertible),
	},
])
