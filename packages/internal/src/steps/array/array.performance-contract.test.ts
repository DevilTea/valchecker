import { describe, expect, it } from 'vitest'
import { array, createValchecker, string, transform } from '../..'

const v = createValchecker({ steps: [array, string, transform] })

describe('array performance contracts', () => {
	it('snapshots remaining values when the first asynchronous item is encountered', async () => {
		let firstItem = true
		let releaseFirst!: () => void
		const input = ['first', 'second', 'third']
		const schema = v.array(v.string()
			.transform((value) => {
				if (firstItem) {
					firstItem = false
					return new Promise<string>((resolve) => {
						releaseFirst = () => resolve(value)
					})
				}
				return value
			}))

		const result = schema.execute(input)
		input[1] = 'mutated-second'
		input[2] = 'mutated-third'
		releaseFirst()

		await expect(result)
			.resolves.toEqual({ value: ['first', 'second', 'third'] })
	})
})
