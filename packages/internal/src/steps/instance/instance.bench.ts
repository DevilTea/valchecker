import { createValchecker, instance } from '../..'
import { stepBench } from '../../test-utils/step-bench'

class Point {
	x = 1
	y = 2
}

const v = createValchecker({ steps: [instance] })
// A user-defined class rather than `Object`, whose prototype chain every value shares:
// the check is one `instanceof` regardless of the constructor, so one cell covers it.
const schema = v.instance(Point)
const valid = new Point()

stepBench('instance', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute(valid),
	},
	{
		name: 'other-class',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['instance:expected_instance'] },
		batch: 100,
		run: () => schema.execute('string'),
	},
])
