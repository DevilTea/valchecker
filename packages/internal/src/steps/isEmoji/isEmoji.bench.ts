import { createValchecker, isEmoji, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isEmoji] })
const schema = v.string()
	.isEmoji()
// `{ registered: true }` is a second algorithm, not a narrower option on the
// first: the default tests the UTS #51 sequence grammar, while the registered set
// is a `v`-flag property-of-strings class consumed by an unanchored `replace`.
const registered = v.string()
	.isEmoji({ registered: true })

const family = '👨\u{200D}👩\u{200D}👧\u{200D}👦'

stepBench('isEmoji', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 50,
		run: () => schema.execute(family),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isEmoji:expected_emoji'] },
		batch: 50,
		run: () => schema.execute('👍a'),
	},
	{
		name: 'valid-registered',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => registered.execute(family),
	},
])
