import { createValchecker, file, isMimeType } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [file, isMimeType] })
// One list of patterns: `types` is normalised to an array at construction, and a
// wildcard pattern differs from an exact one by `startsWith` instead of `===` on the
// same lowercased string, so neither the list form nor the wildcard is a second
// algorithm.
const allowedTypes = ['image/png', 'application/pdf']
const schema = v.file()
	.isMimeType(allowedTypes)
const png = new File(['data'], 'photo.png', { type: 'image/png' })
const gif = new File(['data'], 'photo.gif', { type: 'image/gif' })

stepBench('isMimeType', [
	{
		name: 'allowed-type',
		group: 'warm/success',
		expect: { success: true },
		batch: 100,
		run: () => schema.execute(png),
	},
	{
		name: 'other-type',
		group: 'warm/failure/library-default',
		expect: { success: false, issues: ['isMimeType:unexpected_mime_type'] },
		batch: 50,
		run: () => schema.execute(gif),
	},
])
