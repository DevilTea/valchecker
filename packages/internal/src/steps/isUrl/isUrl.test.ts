import { describe, expect, it } from 'vitest'
import { createValchecker, isUrl, string } from '../..'

const v = createValchecker({ steps: [string, isUrl] })

const valid = [
	'http://example.com',
	'https://example.com/path?q=1',
	'https://sub.example.com:8080',
]

const invalid = [
	'ftp://example.com',
	'not a url',
	'example.com',
	'',
]

describe('isUrl step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isUrl()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isUrl()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isUrl:expected_url' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isUrl()
			.execute('ftp://example.com'))
			.toEqual({
				issues: [{
					code: 'isUrl:expected_url',
					category: 'validation',
					message: 'Expected a valid URL.',
					path: [],
					payload: { value: 'ftp://example.com', protocols: ['http', 'https'] },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isUrl({ message: 'Custom' })
			.execute('ftp://example.com'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})

	it('accepts a caller-supplied protocol allow-list', () => {
		const schema = v.string()
			.isUrl({ protocols: ['ftp'] })
		expect(schema.execute('ftp://example.com'))
			.toEqual({ value: 'ftp://example.com' })
		expect(schema.execute('https://example.com'))
			.toMatchObject({ issues: [{ code: 'isUrl:expected_url' }] })
	})
})
