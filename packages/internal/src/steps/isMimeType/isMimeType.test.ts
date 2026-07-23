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
		['empty type', 'image/png', ''],
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
