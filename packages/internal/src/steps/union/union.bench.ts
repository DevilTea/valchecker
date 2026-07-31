import { boolean, createValchecker, number, string, union } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [boolean, number, string, union] })

const branches = [v.string(), v.number(), v.boolean()] as const
const schema = v.union(branches)

// Reaching the last branch is the representative case: a first-branch hit measures one
// child execution and nothing this step does between branches.
const lastBranch = true
const noBranch = {}

stepBench('union', [
	{
		name: 'later-branch-valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute(lastBranch),
	},
	{
		// `union` owns no issue code; what it does on failure is aggregate every branch's
		// issues and tag each with its branch index, and that is what this measures.
		name: 'all-branches-fail',
		group: 'warm/failure/library-default',
		expect: {
			success: false,
			issues: ['boolean:expected_boolean', 'number:expected_number', 'string:expected_string'],
		},
		batch: 10,
		run: () => schema.execute(noBranch),
	},
	{
		// One of the designated construction cells. Branch normalisation, the literal-member
		// combination, and the template-literal descriptor derivation all happen here and
		// never inside an execution cell. The batch is at the large end deliberately:
		// allocation and garbage collection are inside the timed region, so a construction
		// cell is the noisiest kind and wants a unit big enough to swamp allocator jitter.
		// Ten rather than twenty only because construction here is expensive enough that
		// twenty put the unit above the sizing window.
		name: 'construct',
		group: 'construction',
		expect: { constructs: true },
		batch: 10,
		run: () => v.union(branches),
	},
])
