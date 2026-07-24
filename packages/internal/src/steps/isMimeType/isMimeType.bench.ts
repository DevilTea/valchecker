import { bench, describe } from 'vitest'
import { blob, createValchecker, isMimeType } from '../..'

const v = createValchecker({ steps: [blob, isMimeType] })
const exactSchema = v.blob()
	.isMimeType('image/png')
const wildcardSchema = v.blob()
	.isMimeType('image/*')
const listSchema = v.blob()
	.isMimeType(['image/png', 'image/jpeg', 'application/pdf'])
const png = new Blob(['data'], { type: 'image/png' })
const gif = new Blob(['data'], { type: 'image/gif' })

describe('isMimeType benchmarks', () => {
	bench('exact match', () => {
		exactSchema.execute(png)
	})

	bench('wildcard match', () => {
		wildcardSchema.execute(png)
	})

	bench('list match', () => {
		listSchema.execute(png)
	})

	bench('no match', () => {
		listSchema.execute(gif)
	})
})
