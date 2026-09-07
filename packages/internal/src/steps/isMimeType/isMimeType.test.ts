import type { InferIssue, InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { blob, createValchecker, file, isMimeType } from '../..'

const v = createValchecker({ steps: [blob, file, isMimeType] })

function blobOf(type: string): Blob {
	return new Blob(['data'], { type })
}

describe('isMimeType step plugin', () => {
	it.each([
		['exact string match', 'image/png', 'image/png'],
		['list match', ['application/pdf', 'image/png'], 'image/png'],
		['wildcard match', 'image/*', 'image/jpeg'],
		['wildcard list match', ['text/*', 'image/*'], 'image/gif'],
		['case-insensitive pattern', 'IMAGE/PNG', 'image/png'],
		['case-insensitive wildcard', 'IMAGE/*', 'image/png'],
		['case-insensitive observed type', 'image/png', 'IMAGE/PNG'],
		// A wildcard matches the prefix up to and including the slash, so a
		// parameterised type matches its family even though it never matches a
		// bare type/subtype.
		['wildcard over a parameterised type', 'text/*', 'text/plain;charset=utf-8'],
		['wildcard over token punctuation', 'application/*', 'application/vnd.example+json'],
	])('accepts %s', (_label, types, actual) => {
		const input = blobOf(actual)
		expect(v.blob()
			.isMimeType(types)
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		['exact mismatch', 'image/png', 'image/jpeg'],
		['list mismatch', ['image/png', 'image/jpeg'], 'application/pdf'],
		['wildcard family mismatch', 'image/*', 'text/plain'],
		['wildcard is not a prefix of a longer type', 'image/*', 'imagex/png'],
		['wildcard rejects an empty subtype', 'image/*', 'image/'],
		['wildcard rejects another slash in the subtype', 'image/*', 'image//x'],
		['wildcard rejects a parameter marker with no subtype', 'image/*', 'image/;'],
		['empty type', 'image/png', ''],
		// MIME parameters are not parsed off the observed type, so an exact
		// pattern compares against the whole string including them.
		['exact pattern against a parameterised type', 'text/plain', 'text/plain;charset=utf-8'],
		['exact pattern is not a prefix match', 'text/plain', 'text/plaintext'],
		// Only a trailing `/*` is a wildcard, and only over the subtype: `*` is
		// compared literally as a type name, which nothing has.
		['a full wildcard is not supported', '*/*', 'image/png'],
		['a leading wildcard is not supported', '*/png', 'image/png'],
	])('rejects %s', (_label, types, actual) => {
		expect(v.blob()
			.isMimeType(types)
			.execute(blobOf(actual)))
			.toMatchObject({ issues: [{ code: 'isMimeType:unexpected_mime_type' }] })
	})

	it('reports the owned issue code and payload shape', () => {
		const input = blobOf('application/pdf')
		expect(v.blob()
			.isMimeType(['image/png', 'image/jpeg'])
			.execute(input))
			.toEqual({
				issues: [{
					code: 'isMimeType:unexpected_mime_type',
					category: 'validation',
					message: 'Expected a MIME type matching image/png, image/jpeg.',
					path: [],
					payload: { value: input, expected: ['image/png', 'image/jpeg'], actual: 'application/pdf' },
				}],
			})
	})

	it('preserves the single-string expected in the payload', () => {
		const input = blobOf('text/plain')
		expect(v.blob()
			.isMimeType('image/*')
			.execute(input))
			.toMatchObject({
				issues: [{ payload: { expected: 'image/*', actual: 'text/plain' } }],
			})
	})

	it('snapshots mutable list configuration and diagnostic payloads', () => {
		const types = ['image/png', 'application/pdf']
		const schema = v.blob()
			.isMimeType(types)
		types.splice(0, types.length, 'text/plain')

		const accepted = blobOf('image/png')
		expect(schema.execute(accepted))
			.toEqual({ value: accepted })

		const rejected = blobOf('text/plain')
		const firstFailure = schema.execute(rejected)
		expect(firstFailure)
			.toEqual({
				issues: [{
					code: 'isMimeType:unexpected_mime_type',
					category: 'validation',
					message: 'Expected a MIME type matching image/png, application/pdf.',
					path: [],
					payload: { value: rejected, expected: ['image/png', 'application/pdf'], actual: 'text/plain' },
				}],
			})
		if (!v.isFailure(firstFailure))
			throw new Error('Expected a failure result.')
		const issue = firstFailure.issues[0]!
		if (issue.code !== 'isMimeType:unexpected_mime_type')
			throw new Error(`Unexpected issue: ${issue.code}`)
		if (!Array.isArray(issue.payload.expected))
			throw new Error('Expected an array diagnostic payload.')
		issue.payload.expected.push('mutated')

		expect(schema.execute(rejected))
			.toEqual({
				issues: [{
					code: 'isMimeType:unexpected_mime_type',
					category: 'validation',
					message: 'Expected a MIME type matching image/png, application/pdf.',
					path: [],
					payload: { value: rejected, expected: ['image/png', 'application/pdf'], actual: 'text/plain' },
				}],
			})
	})

	it('rejects an empty type list during schema construction', () => {
		expect(() => v.blob()
			.isMimeType([]))
			.toThrowError('isMimeType() requires at least one MIME type.')
	})

	it('supports custom messages', () => {
		expect(v.blob()
			.isMimeType('image/png', { message: 'Custom mime' })
			.execute(blobOf('image/jpeg')))
			.toMatchObject({ issues: [{ message: 'Custom mime' }] })
	})

	it('composes on file outputs and preserves the output type', () => {
		const input = new File(['data'], 'name.png', { type: 'image/png' })
		const schema = v.file()
			.isMimeType('image/*')
		expect(schema.execute(input))
			.toEqual({ value: input })
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<File>()
	})

	it('exposes the owned issue payload type contract', () => {
		const _schema = v.blob()
			.isMimeType('image/*')
		expectTypeOf<Extract<InferIssue<typeof _schema>, { code: 'isMimeType:unexpected_mime_type' }>['payload']>()
			.toEqualTypeOf<{ value: Blob, expected: string | string[], actual: string }>()
	})
})
