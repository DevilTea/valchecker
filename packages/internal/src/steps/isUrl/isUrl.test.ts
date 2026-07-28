import { describe, expect, it } from 'vitest'
import { createValchecker, isUrl, string } from '../..'

const v = createValchecker({ steps: [string, isUrl] })

const valid = [
	'http://example.com',
	'https://example.com/path?q=1',
	'https://sub.example.com:8080',
	// The check is `new URL()` plus a scheme allow-list and nothing else, so a
	// single-label host with no dot and no TLD parses and is accepted.
	'http://a',
	// `URL` normalizes the scheme before it is compared, so an uppercase scheme
	// in the input matches the lowercase allow-list.
	'HTTPS://example.com',
	// For a special scheme `URL` treats a missing `//` as present:
	// `new URL('http:example.com').href` is `http://example.com/`.
	'http:example.com',
	// An internationalized host is punycoded by `URL` rather than rejected. The
	// step preserves the input string, not `url.href`.
	'http://例え.jp',
]

const invalid = [
	'ftp://example.com',
	'not a url',
	'example.com',
	'',
	// A scheme-relative reference has no base to resolve against, so `URL`
	// throws. Only absolute URLs pass.
	'//example.com',
	'/path',
	// A special scheme with an empty host is a parse failure.
	'http://',
	// A space in the host is a parse failure rather than an escaped character.
	'http://exa mple.com',
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

	it('normalizes supplied protocols to lowercase', () => {
		expect(v.string()
			.isUrl({ protocols: ['HTTP'] })
			.execute('http://example.com'))
			.toEqual({ value: 'http://example.com' })
	})

	it('reports the normalized allow-list in the payload', () => {
		expect(v.string()
			.isUrl({ protocols: ['FTP'] })
			.execute('https://example.com'))
			.toMatchObject({ issues: [{ payload: { protocols: ['ftp'] } }] })
	})

	it.each([
		['mailto', 'mailto:ada@example.com'],
		['file', 'file:///tmp/x'],
	])('accepts an allow-listed %s URL that carries no host', (protocol, input) => {
		expect(v.string()
			.isUrl({ protocols: [protocol] })
			.execute(input))
			.toEqual({ value: input })
	})

	it('rejects every URL when the allow-list is empty', () => {
		expect(v.string()
			.isUrl({ protocols: [] })
			.execute('https://example.com'))
			.toMatchObject({ issues: [{ code: 'isUrl:expected_url', payload: { protocols: [] } }] })
	})

	it('copies the allow-list, so mutating it afterwards cannot widen the schema', () => {
		const protocols = ['ftp']
		const schema = v.string()
			.isUrl({ protocols })
		protocols.push('https')
		expect(schema.execute('https://example.com'))
			.toMatchObject({ issues: [{ code: 'isUrl:expected_url', payload: { protocols: ['ftp'] } }] })
	})

	it('freezes the allow-list it reports, so a consumer cannot mutate it', () => {
		const failure = v.string()
			.isUrl()
			.execute('ftp://example.com') as unknown as { issues: [{ payload: { protocols: string[] } }] }
		expect(() => failure.issues[0].payload.protocols.push('ftp'))
			.toThrow()
	})
})
