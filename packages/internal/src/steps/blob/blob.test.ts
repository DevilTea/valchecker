import type { InferIssue, InferOutput } from '../../core'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { blob, createValchecker, isSizeAtMost } from '../..'

const v = createValchecker({ steps: [blob, isSizeAtMost] })

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('blob step plugin', () => {
	it('accepts a Blob instance', () => {
		const input = new Blob(['data'])
		expect(v.blob()
			.execute(input))
			.toEqual({ value: input })
	})

	it('accepts a File because File extends Blob', () => {
		const input = new File(['data'], 'name.txt')
		expect(v.blob()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		['string', 'not a blob'],
		['null', null],
		['undefined', undefined],
		['plain object', {}],
	])('rejects %s', (_label, input) => {
		expect(v.blob()
			.execute(input))
			.toEqual({
				issues: [{
					code: 'blob:expected_blob',
					category: 'validation',
					message: 'Expected a Blob.',
					path: [],
					payload: { value: input },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.blob({ message: 'Custom blob' })
			.execute('nope'))
			.toMatchObject({ issues: [{ message: 'Custom blob' }] })
	})

	it('fails without throwing when the Blob global is unavailable', () => {
		const input = new Blob(['data'])
		vi.stubGlobal('Blob', undefined)
		expect(v.blob()
			.execute(input))
			.toEqual({
				issues: [{
					code: 'blob:expected_blob',
					category: 'validation',
					message: 'Expected a Blob.',
					path: [],
					payload: { value: input },
				}],
			})
	})

	it('exposes Blob output and owned issue type contracts', () => {
		const _schema = v.blob()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Blob>()
		expectTypeOf<Extract<InferIssue<typeof _schema>, { code: 'blob:expected_blob' }>['payload']>()
			.toEqualTypeOf<{ value: unknown }>()
	})
})
