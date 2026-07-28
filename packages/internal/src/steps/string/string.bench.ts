import { createValchecker, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string] })
const schema = v.string()
const messaged = v.string({ message: 'custom' })

stepBench('string', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 200,
		run: () => schema.execute('hello'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['string:expected_string'] },
		batch: 100,
		run: () => schema.execute(123),
	},
	{
		// One of the designated message cells. The deferred message chain was dark: no cell
		// anywhere passed a `message`, so `hasIssueDraft()` was always false and eight
		// functions behind it never ran under the benchmark tree. It is closed with a couple
		// of designated cells rather than one per step, because the chain is one mechanism
		// and 92 copies of it would measure the same code 92 times.
		//
		// This is the originating-step half: the step's own message is the highest-priority
		// scope an issue is finished against. The code is unchanged — a `message` changes how
		// the issue is finished, not what it is.
		name: 'custom-message',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['string:expected_string'] },
		batch: 20,
		run: () => messaged.execute(123),
	},
	{
		// One of the designated construction/cold cells. Module initialisation and the shape
		// of the prototype every schema shares are not attributable to a step through its
		// execution cells, because a cell constructs its schema at module scope and the timed
		// region never sees it. These two put that work back inside a measured unit, on the
		// cheapest initial schema there is, so what they report is nearly all construction.
		//
		// Construction is also the noisiest kind of cell — allocation and garbage collection
		// sit inside the timed region — so the batch is at the large end deliberately, to
		// swamp allocator jitter rather than sample it.
		name: 'construct',
		group: 'construction',
		expect: { constructs: true },
		batch: 50,
		run: () => v.string(),
	},
	{
		name: 'cold',
		group: 'cold',
		expect: { success: true },
		batch: 50,
		run: () => v.string()
			.execute('hello'),
	},
])
