import { createValchecker, toStrictJSONString } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [toStrictJSONString] })

// This step accepts any current value, so it needs no enclosing step at all: the unit is
// `execute()` plus the single-read preflight and `JSON.stringify`.
const schema = v.toStrictJSONString()

// Nested rather than flat, because the preflight is a recursive walk that copies every
// slot: `{ value: 42 }` measured one visit and none of the recursion, the array branch,
// or the boxed/`toJSON` dispatch that follows it.
const value = { id: 'u-1', tags: ['a', 'b'], meta: { active: true, score: 3 } }
// A function has no JSON representation, so the walk stops at `meta.render` with this
// step's own validation issue. `serialization_failed` — a throwing getter, Proxy trap, or
// `toJSON` — is the same failure construction reached through a rarer input, so it is not
// a second cell.
const unserializable = { id: 'u-1', meta: { render: () => undefined } }

stepBench('toStrictJSONString', [
	{
		name: 'nested-object',
		group: 'warm/success',
		expect: { success: true },
		batch: 2,
		run: () => schema.execute(value),
	},
	{
		name: 'unserializable',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['toStrictJSONString:unserializable'] },
		batch: 5,
		run: () => schema.execute(unserializable),
	},
])
