import { createValchecker, file, isMimeType } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [file, isMimeType] })
// One list of patterns: `types` is normalised to an array at construction. The
// success cell deliberately hits the wildcard path, including its MIME type/subtype
// shape guard; the failure cell misses the configured families.
const allowedTypes = ['image/*', 'application/pdf']
const schema = v.file()
	.isMimeType(allowedTypes)
const png = new File(['data'], 'photo.png', { type: 'image/png' })
const text = new File(['data'], 'note.txt', { type: 'text/plain' })

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
		run: () => schema.execute(text),
	},
])
