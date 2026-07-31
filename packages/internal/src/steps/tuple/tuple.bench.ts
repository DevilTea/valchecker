import { array, boolean, createValchecker, number, string, transform, tuple } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [tuple, array, boolean, number, string, transform] })

// A rest region is a different traversal, not a different input: it walks a prefix, a
// sliced rest, and a suffix through three separate loops, none of which a rest-less
// tuple reaches. Hence one success cell each.
const fixed = v.tuple([v.string(), v.number(), v.boolean()])
const withRest = v.tuple([v.string(), '...', v.array(v.boolean()), v.number()])
const collecting = v.tuple([v.string(), v.number(), v.boolean()], { collectAllIssues: true })
const asyncSchema = v.tuple([
	v.string()
		.transform((value: string) => Promise.resolve(value)),
	v.number(),
])

const fixedInput = ['a', 1, true]
const restInput = ['a', true, false, 1]
const asyncInput = ['a', 1]
const tooShort = ['a', 1]
const twoBadElements = ['a', 'x', 'y']

stepBench('tuple', [
	{
		name: 'fixed-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => fixed.execute(fixedInput),
	},
	{
		name: 'rest-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => withRest.execute(restInput),
	},
	{
		name: 'unexpected-length',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['tuple:unexpected_length'] },
		batch: 50,
		run: () => fixed.execute(tooShort),
	},
	{
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['boolean:expected_boolean', 'number:expected_number'] },
		batch: 10,
		run: () => collecting.execute(twoBadElements),
	},
	{
		name: 'async-valid',
		group: 'warm/async/success',
		async: true,
		expect: { success: true },
		batch: 5,
		run: () => asyncSchema.execute(asyncInput),
	},
])
