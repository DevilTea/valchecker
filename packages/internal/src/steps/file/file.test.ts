import type { InferIssue, InferOutput } from '../../core'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createValchecker, file, isSizeAtMost } from '../..'

const v = createValchecker({ steps: [file, isSizeAtMost] })

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('file step plugin', () => {
	it('accepts a File instance', () => {
		const input = new File(['data'], 'name.txt')
		expect(v.file()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		['string', 'not a file'],
		['null', null],
		['undefined', undefined],
		['plain object', {}],
		['Blob (not a File)', new Blob(['data'])],
	])('rejects %s', (_label, input) => {
		expect(v.file()
			.execute(input))
			.toEqual({
				issues: [{
					code: 'file:expected_file',
					category: 'validation',
					message: 'Expected a File.',
					path: [],
					payload: { value: input },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.file({ message: 'Custom file' })
			.execute('nope'))
			.toMatchObject({ issues: [{ message: 'Custom file' }] })
	})

	it('fails without throwing when the File global is unavailable', () => {
		const input = new File(['data'], 'name.txt')
		vi.stubGlobal('File', undefined)
		expect(v.file()
			.execute(input))
			.toEqual({
				issues: [{
					code: 'file:expected_file',
					category: 'validation',
					message: 'Expected a File.',
					path: [],
					payload: { value: input },
				}],
			})
	})

	it('composes with size validation', () => {
		const small = new File(['ab'], 'small.txt')
		const large = new File(['abcdef'], 'large.txt')
		const schema = v.file()
			.isSizeAtMost(3)
		expect(schema.execute(small))
			.toEqual({ value: small })
		expect(schema.execute(large))
			.toMatchObject({ issues: [{ code: 'isSizeAtMost:expected_size_at_most' }] })
	})

	it('exposes File output and owned issue type contracts', () => {
		const _schema = v.file()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<File>()
		expectTypeOf<Extract<InferIssue<typeof _schema>, { code: 'file:expected_file' }>['payload']>()
			.toEqualTypeOf<{ value: unknown }>()
	})
})
