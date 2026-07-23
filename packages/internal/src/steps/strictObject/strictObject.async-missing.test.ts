import { describe, expect, it } from 'vitest'
import { createValchecker, number, strictObject, string, transform } from '../..'

const v = createValchecker({ steps: [number, strictObject, string, transform] })

describe('strictObject asynchronous missing-key contracts', () => {
	it('materializes a missing optional key after an earlier child becomes asynchronous', async () => {
		const schema = v.strictObject({
			first: v.string()
				.transform(async value => value.toUpperCase()),
			optional: [v.number()],
			last: v.string(),
		})

		await expect(schema.execute({
			first: 'ada',
			last: 'present',
		})).resolves.toEqual({
			value: {
				first: 'ADA',
				optional: undefined,
				last: 'present',
			},
		})
	})

	it('reports a missing required key after an earlier child becomes asynchronous', async () => {
		const schema = v.strictObject({
			first: v.string()
				.transform(async value => value.toUpperCase()),
			required: v.number(),
			last: v.string(),
		})

		await expect(schema.execute({
			first: 'ada',
			last: 'still validated',
		})).resolves.toEqual({
			issues: [{
				code: 'strictObject:missing_key',
				category: 'validation',
				message: 'Missing required object key.',
				path: ['required'],
				payload: { key: 'required' },
			}],
		})
	})
})
