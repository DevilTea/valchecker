import { describe, expect, it } from 'vitest'
import { createValchecker, isMatching, string } from '../..'

const v = createValchecker({ steps: [isMatching, string] })

describe('isMatching step plugin', () => {
	it('matches repeatedly without retaining regular-expression state', () => {
		const pattern = /foo/gi
		pattern.lastIndex = 99
		const schema = v.string().isMatching(pattern)
		expect(schema.execute('FOO')).toEqual({ value: 'FOO' })
		expect(schema.execute('FOO')).toEqual({ value: 'FOO' })
	})

	it('reports immutable schema-time pattern metadata and custom messages', () => {
		const failure = v.string().isMatching(/^foo$/, { message: 'Pattern required' }).execute('bar') as any
		expect(failure).toMatchObject({
			issues: [{
				message: 'Pattern required',
				payload: { value: 'bar', pattern: { source: '^foo$', flags: '' } },
			}],
		})
		expect(() => { failure.issues[0].payload.pattern.source = 'changed' }).toThrow()
	})

	it('rejects non-RegExp patterns for JavaScript callers', () => {
		expect(() => v.string().isMatching('foo' as any)).toThrow(TypeError)
	})
})
