import { createValchecker, isOneOf, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [isOneOf, string] })
// One linear `Object.is` scan whatever the candidates are: the step switches no
// strategy by candidate count or kind, so the set size is an input to one algorithm
// rather than a second one. The failure cell walks the whole set.
const schema = v.string()
	.isOneOf(['draft', 'review', 'published'])

stepBench('isOneOf', [
	{
		name: 'member',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('review'),
	},
	{
		// A string, so it clears `string` and no candidate matching is what fails.
		name: 'non-member',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isOneOf:expected_one_of'] },
		batch: 100,
		run: () => schema.execute('archived'),
	},
])
