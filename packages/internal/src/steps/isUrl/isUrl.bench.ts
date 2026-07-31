import { createValchecker, isUrl, string } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [string, isUrl] })
const schema = v.string()
	.isUrl()

// `protocols` is not a second algorithm: the option only changes the contents of
// the allow-list the same `protocols.includes()` reads after the same `new URL()`
// parse, so it gets no cell of its own.

stepBench('isUrl', [
	{
		name: 'valid',
		group: 'warm/success',
		expect: { success: true },
		batch: 20,
		run: () => schema.execute('https://example.com/path'),
	},
	{
		name: 'invalid',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isUrl:expected_url'] },
		batch: 2,
		run: () => schema.execute('not a url'),
	},
])
