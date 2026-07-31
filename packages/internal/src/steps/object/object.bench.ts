import { boolean, createValchecker, number, object, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [boolean, number, object, string] })

// A non-empty shape, because `v.object({})` never enters the child-execute loop —
// which is what every one of `object`, `strictObject`, and `looseObject` used to
// measure. Four keys over three primitive kinds is the smallest shape that walks the
// loop, resolves more than one child kind, and can miss a key.
const shape = {
	id: v.string(),
	name: v.string(),
	age: v.number(),
	active: v.boolean(),
}
const schema = v.object(shape)
const collecting = v.object(shape, { collectAllIssues: true })
const scoped = v.object(shape, { message: 'Invalid user.' })

const valid = { id: 'u-1', name: 'Ada', age: 36, active: true }
const missingKey = { id: 'u-1', name: 'Ada', age: 36 }
const oneBadChild = { id: 'u-1', name: 'Ada', age: 'thirty-six', active: true }
const twoBadChildren = { id: 'u-1', name: 'Ada', age: 'thirty-six', active: 'yes' }

stepBench('object', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 10,
		run: () => schema.execute(valid),
	},
	{
		name: 'missing-key',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['object:missing_key'] },
		batch: 10,
		run: () => schema.execute(missingKey),
	},
	{
		// The dual traversal policy: `collectAllIssues` keeps walking after the first
		// failing child. Nothing in the benchmark tree measured it once the cross-library
		// scenarios stopped being the impact gate's unit, and it is a distinct algorithm
		// through the same structure rather than a second input to the same one.
		name: 'collect-all',
		group: 'warm/failure/all',
		expect: { success: false, issues: ['boolean:expected_boolean', 'number:expected_number'] },
		batch: 10,
		run: () => collecting.execute(twoBadChildren),
	},
	{
		// One of the designated message cells. The deferred message chain was dark: no cell
		// anywhere passed a `message`, so `hasIssueDraft()` was always false and eight
		// functions behind it never ran under the benchmark tree at all. It is closed with a
		// few designated cells rather than one per step, because the chain is one mechanism
		// and 92 copies of it would measure the same code 92 times.
		//
		// This is the enclosing-scope half: a child fails, and the structure's own message
		// becomes the scope its issue is finished against.
		name: 'enclosing-message',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['number:expected_number'] },
		batch: 10,
		run: () => scoped.execute(oneBadChild),
	},
	{
		// One of the designated construction/cold cells. Module initialisation and the shape
		// of the prototype every schema shares are not attributable to a step through its
		// execution cells, because a cell constructs its schema at module scope and the timed
		// region never sees it. These two put that work back inside a measured unit.
		//
		// Construction is also the noisiest kind of cell — allocation and garbage collection
		// sit inside the timed region, and the one precise false positive in the gate's
		// hosted-runner null runs was a `construct/*` cell — so the batch is at the large end
		// deliberately, to swamp allocator jitter rather than sample it.
		name: 'construct',
		group: 'construction',
		expect: { constructs: true },
		batch: 20,
		run: () => v.object(shape),
	},
	{
		name: 'cold',
		group: 'cold',
		expect: { success: true },
		batch: 20,
		run: () => v.object(shape)
			.execute(valid),
	},
])
