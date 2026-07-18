import { describe, expect, it } from 'vitest'
import { createValchecker, isMatching, string } from '../..'
const v = createValchecker({ steps: [isMatching, string] })
describe('isMatching step plugin', () => {
	it('matches strings and snapshots pattern metadata', () => {
		const pattern = /foo/gi
		pattern.lastIndex = 99
		const schema = v.string().isMatching(pattern)
		expect(schema.execute('FOO')).toEqual({ value: 'FOO' })
		expect(schema.execute('FOO')).toEqual({ value: 'FOO' })
	})
	it('reports immutable pattern metadata and custom messages', () => {
		expect(v.string().isMatching(/^foo$/, { message: 'Pattern required' }).execute('bar')).toMatchObject({ issues: [{ message: 'Pattern required', payload: { value: 'bar', pattern: { source: '^foo$', flags: '' } } }] })
	})
})
