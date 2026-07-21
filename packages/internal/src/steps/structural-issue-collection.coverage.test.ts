import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../core'
import {
	array,
	createValchecker,
	intersection,
	looseObject,
	map,
	number,
	object,
	set,
	strictObject,
	string,
	transform,
	unknown,
} from '..'

const fixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	asyncInternalFailure: ({ utils }: any) => {
		utils.addSuccessStep(async () => {
			throw new Error('async internal failure')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({
	steps: [
		array,
		fixture,
		intersection,
		looseObject,
		map,
		number,
		object,
		set,
		strictObject,
		string,
		transform,
		unknown,
	],
})

function issueCodes(result: any): string[] {
	return result.issues?.map((issue: { code: string }) => issue.code) ?? []
}

function objectSchemas(shape: Record<PropertyKey, any>) {
	return [
		(v as any).object(shape, { collectAllIssues: true }),
		(v as any).strictObject(shape, { collectAllIssues: true }),
		(v as any).looseObject(shape, { collectAllIssues: true }),
	]
}

describe('structural issue collection paths', () => {
	it('rejects invalid containers in collect-all mode', () => {
		expect(issueCodes(v.array(v.string(), { collectAllIssues: true }).execute({})))
			.toEqual(['array:expected_array'])
		expect(issueCodes(v.set(v.string(), { collectAllIssues: true }).execute([])))
			.toEqual(['set:expected_set'])
		expect(issueCodes(v.map({ key: v.string(), value: v.number(), collectAllIssues: true }).execute({})))
			.toEqual(['map:expected_map'])
		expect(issueCodes(v.object({}, { collectAllIssues: true }).execute([])))
			.toEqual(['object:expected_object'])
		expect(issueCodes(v.strictObject({}, { collectAllIssues: true }).execute(null)))
			.toEqual(['strictObject:expected_object'])
		expect(issueCodes(v.looseObject({}, { collectAllIssues: true }).execute([])))
			.toEqual(['looseObject:expected_object'])
	})

	it('materializes optional and __proto__ fields in collect-all object variants', () => {
		const ignored = Symbol('ignored')
		const shape: Record<PropertyKey, any> = {
			required: v.string(),
			optional: [v.number()],
		}
		Object.defineProperty(shape, '__proto__', {
			enumerable: true,
			value: v.string(),
		})
		Object.defineProperty(shape, ignored, {
			enumerable: false,
			value: v.string(),
		})

		const input: Record<PropertyKey, unknown> = { required: 'ok' }
		Object.defineProperty(input, '__proto__', {
			enumerable: true,
			value: 'safe',
		})

		for (const schema of objectSchemas(shape)) {
			const result = schema.execute(input)
			expect(result).toMatchObject({
				value: { required: 'ok', optional: undefined },
			})
			expect(Object.hasOwn(result.value, '__proto__')).toBe(true)
			expect(result.value.__proto__).toBe('safe')
		}
	})

	it('collects missing fields and stops object variants on a synchronous internal issue', () => {
		for (const schema of objectSchemas({
			missing: v.string(),
			invalid: v.number(),
			internal: (v as any).unknown().internalFailure(),
			later: (v as any).unknown().observe(() => {
				throw new Error('later field must not execute')
			}),
		})) {
			const result = schema.execute({ invalid: 'bad', internal: 'value', later: 'later' })
			expect(issueCodes(result)).toEqual([
				expect.stringMatching(/:missing_key$/),
				'number:expected_number',
				'core:unknown_exception',
			])
		}
	})

	it('continues collect-all object variants after asynchronous recoverable failures', async () => {
		for (const schema of objectSchemas({
			first: v.string().transform(async () => {
				throw new Error('recoverable')
			}),
			optional: [v.number()],
			last: v.string().transform(value => value.toUpperCase()),
			missing: v.string(),
		})) {
			const result = await schema.execute({ first: 'bad', last: 'ok' })
			expect(issueCodes(result)).toEqual([
				'transform:callback_failed',
				expect.stringMatching(/:missing_key$/),
			])
		}
	})

	it('stops collect-all object variants after an asynchronous internal issue', async () => {
		for (const schema of objectSchemas({
			first: (v as any).unknown().asyncInternalFailure(),
			later: (v as any).unknown().observe(() => {
				throw new Error('later field must not execute')
			}),
		})) {
			const result = await schema.execute({ first: 'bad', later: 'later' })
			expect(issueCodes(result)).toEqual(['core:unknown_exception'])
		}
	})

	it('covers successful and fatal array collect-all continuations', async () => {
		const asyncItem = v.string().transform(async value => value.toUpperCase())
		await expect(v.array(asyncItem, { collectAllIssues: true }).execute(['a', 'b']))
			.resolves.toEqual({ value: ['A', 'B'] })

		const later = vi.fn()
		const internal = (v as any).unknown().asyncInternalFailure()
		const observed = (v as any).unknown().observe(later)
		const item = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: observed['~execute'](value),
		} as any
		await expect((v as any).array(item, { collectAllIssues: true }).execute(['internal', 'later']))
			.resolves.toMatchObject({ issues: [{ category: 'internal', path: [0] }] })
		expect(later).not.toHaveBeenCalled()
	})

	it('collects Set collisions and continues asynchronous item traversal', async () => {
		let first = true
		const item = v.string().transform((value) => {
			const transformed = value.toLowerCase()
			if (first) {
				first = false
				return Promise.resolve(transformed)
			}
			return transformed
		})
		const result = await v.set(item, { collectAllIssues: true })
			.execute(new Set(['A', 'a', 'B']))
		expect(issueCodes(result)).toEqual(['set:duplicate_transformed_item'])
		expect((result as any).issues[0]).toMatchObject({ path: [1] })
	})

	it('stops Set collect-all traversal on synchronous and asynchronous internal issues', async () => {
		for (const internal of [
			(v as any).unknown().internalFailure(),
			(v as any).unknown().asyncInternalFailure(),
		]) {
			const later = vi.fn()
			const observed = (v as any).unknown().observe(later)
			const item = {
				'~execute': (value: unknown) => value === 'internal'
					? internal['~execute'](value)
					: observed['~execute'](value),
			} as any
			const result = await (v as any).set(item, { collectAllIssues: true })
				.execute(new Set(['internal', 'later']))
			expect(issueCodes(result)).toEqual(['core:unknown_exception'])
			expect(later).not.toHaveBeenCalled()
		}
	})

	it('covers default asynchronous Map key and value failures', async () => {
		const valueRuns = vi.fn()
		const keyFailure = await v.map({
			key: v.string().transform(async () => {
				throw new Error('key')
			}),
			value: v.number().transform(value => {
				valueRuns()
				return value
			}),
		}).execute(new Map([['a', 1], ['b', 2]]))
		expect(issueCodes(keyFailure)).toEqual(['transform:callback_failed'])
		expect(valueRuns).not.toHaveBeenCalled()

		const valueFailure = await v.map({
			key: v.string(),
			value: v.number().transform(async () => {
				throw new Error('value')
			}),
		}).execute(new Map([['a', 1], ['b', 2]]))
		expect(issueCodes(valueFailure)).toEqual(['transform:callback_failed'])
	})

	it('covers successful asynchronous Map key and value continuations', async () => {
		const keyFirst = await v.map({
			key: v.string().transform(async value => value.toUpperCase()),
			value: v.number(),
		}).execute(new Map([['a', 1], ['b', 2]]))
		expect(keyFirst).toEqual({ value: new Map([['A', 1], ['B', 2]]) })

		const valueFirst = await v.map({
			key: v.string(),
			value: v.number().transform(async value => value * 10),
		}).execute(new Map([['a', 1], ['b', 2]]))
		expect(valueFirst).toEqual({ value: new Map([['a', 10], ['b', 20]]) })
	})

	it('collects Map collisions in synchronous and asynchronous continuations', async () => {
		const syncResult = v.map({
			key: v.string().transform(value => value.toLowerCase()),
			value: v.number(),
			collectAllIssues: true,
		}).execute(new Map([['A', 1], ['a', 2], ['B', 3]]))
		expect(issueCodes(syncResult)).toEqual(['map:duplicate_transformed_key'])

		let first = true
		const asyncResult = await v.map({
			key: v.string().transform((value) => {
				const transformed = value.toLowerCase()
				if (first) {
					first = false
					return Promise.resolve(transformed)
				}
				return transformed
			}),
			value: v.number().transform(async value => value),
			collectAllIssues: true,
		}).execute(new Map([['A', 1], ['a', 2], ['B', 3]]))
		expect(issueCodes(asyncResult)).toEqual(['map:duplicate_transformed_key'])
	})

	it('stops Map collect-all traversal on internal key and value issues', async () => {
		const valueRuns = vi.fn()
		const internalKey = (v as any).unknown().asyncInternalFailure()
		const keyResult = await (v as any).map({
			key: internalKey,
			value: (v as any).unknown().observe(valueRuns),
			collectAllIssues: true,
		}).execute(new Map([['a', 1], ['b', 2]]))
		expect(issueCodes(keyResult)).toEqual(['core:unknown_exception'])
		expect(valueRuns).not.toHaveBeenCalled()

		const later = vi.fn()
		const internalValue = (v as any).unknown().asyncInternalFailure()
		const observed = (v as any).unknown().observe(later)
		const value = {
			'~execute': (entryValue: unknown) => entryValue === 'internal'
				? internalValue['~execute'](entryValue)
				: observed['~execute'](entryValue),
		} as any
		const valueResult = await (v as any).map({
			key: v.string(),
			value,
			collectAllIssues: true,
		}).execute(new Map([['a', 'internal'], ['b', 'later']]))
		expect(issueCodes(valueResult)).toEqual(['core:unknown_exception'])
		expect(later).not.toHaveBeenCalled()
	})

	it('covers successful and failing default asynchronous intersection continuations', async () => {
		const success = await v.intersection([
			v.unknown().transform(async value => ({ left: value })),
			v.unknown().transform(value => ({ right: value })),
		]).execute('ok')
		expect(success).toEqual({ value: { left: 'ok', right: 'ok' } })

		const failure = await v.intersection([
			v.unknown().transform(async value => value),
			v.number(),
		]).execute('bad')
		expect(issueCodes(failure)).toEqual(['number:expected_number'])
	})

	it('covers collect-all intersection success, conflict messages, and internal failure', async () => {
		const success = v.intersection([
			v.unknown().transform(() => ({ left: true })),
			v.unknown().transform(() => ({ right: true })),
		], { collectAllIssues: true })
			.execute(null)
		expect(success).toEqual({ value: { left: true, right: true } })

		const conflict = v.intersection([
			v.unknown().transform(() => 'left'),
			v.unknown().transform(() => 'right'),
		], { collectAllIssues: true, message: 'conflict' })
			.execute(null)
		expect(conflict).toMatchObject({ issues: [{ code: 'intersection:conflicting_outputs', message: 'conflict' }] })

		const later = vi.fn()
		const internal = await (v as any).intersection([
			(v as any).unknown().internalFailure(),
			(v as any).unknown().observe(later),
		], { collectAllIssues: true }).execute('value')
		expect(issueCodes(internal)).toEqual(['core:unknown_exception'])
		expect(later).not.toHaveBeenCalled()
	})
})
