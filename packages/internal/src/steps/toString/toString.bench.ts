import { createValchecker, number, toString } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, toString] })
const schema = v.number()
	.toString()
// A radix conversion is a different path through the host `toString` than the default
// decimal one, so it gets its own cell.
const hex = v.number()
	.toString({ radix: 16 })
// The step delegates to the value's own `toString` and adopts no policy of its own, so
// its issue is reachable only when that method throws. `Number.prototype.toString`
// throws a `RangeError` on a radix outside 2–36, which is the cheapest input that
// reaches it. The cell this replaced passed a string, which failed in `number`.
const invalidRadix = v.number()
	.toString({ radix: 1 })

stepBench('toString', [
	{
		name: 'decimal',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(123456789),
	},
	{
		name: 'radix',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => hex.execute(255),
	},
	{
		name: 'conversion-failed',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toString:conversion_failed'] },
		batch: 5,
		run: () => invalidRadix.execute(255),
	},
])
