import { describe, expect, it, vi } from 'vitest'
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

const v = createValchecker({
	steps: [
		array,
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

function issueCodes(result: unknown): string[] {
	return 'issues' in (result as { issues?: unknown })
		? (result as { issues: Array<{ code: string }> }).issues.map(issue => issue.code)
		: []
}

describe('structural collectAllIssues contract', () => {
	it('object variants stop at the first recoverable issue by default', () => {
		for (const createSchema of [
			() => v.object({ first: v.number(), second: v.string() }),
			() => v.strictObject({ first: v.number(), second: v.string() }),
			() => v.looseObject({ first: v.number(), second: v.string() }),
		]) {
			expect(issueCodes(createSchema().execute({ first: 'bad', second: 1 })))
				.toEqual(['number:expected_number'])
		}
	})

	it('object variants collect later field issues when enabled', () => {
		for (const createSchema of [
			() => v.object({ first: v.number(), second: v.string() }, { collectAllIssues: true }),
			() => v.strictObject({ first: v.number(), second: v.string() }, { collectAllIssues: true }),
			() => v.looseObject({ first: v.number(), second: v.string() }, { collectAllIssues: true }),
		]) {
			expect(issueCodes(createSchema().execute({ first: 'bad', second: 1 })))
				.toEqual(['number:expected_number', 'string:expected_string'])
		}
	})

	it('strictObject returns unexpected keys before declared-field issues by default', () => {
		const result = v.strictObject({ missing: v.string(), invalid: v.number() })
			.execute({ invalid: 'bad', extra: true })
		expect(issueCodes(result))
			.toEqual(['strictObject:unexpected_keys'])
	})

	it('array and Set stop later items by default', () => {
		for (const createSchema of [
			(item: ReturnType<typeof v.unknown>) => v.array(item),
			(item: ReturnType<typeof v.unknown>) => v.set(item),
		]) {
			const runs: unknown[] = []
			const item = v.unknown()
				.transform((value) => {
					runs.push(value)
					if (value === 'bad')
						throw new Error('bad')
					return value
				})
			const input = createSchema === undefined
				? []
				: undefined
			const schema = createSchema(item)
			const result = schema.execute(schema === schema && createSchema.name === ''
				? ['bad', 'later']
				: ['bad', 'later'])
			void input
			expect(issueCodes(result))
				.toEqual(['transform:callback_failed'])
			expect(runs)
				.toEqual(['bad'])
		}
	})

	it('array and Set collect later items when enabled', () => {
		const arrayRuns: unknown[] = []
		const arrayResult = v.array(v.unknown().transform((value) => {
			arrayRuns.push(value)
			if (value === 'bad')
				throw new Error('bad')
			return value
		}), { collectAllIssues: true })
			.execute(['bad', 'later'])
		expect(issueCodes(arrayResult))
			.toEqual(['transform:callback_failed'])
		expect(arrayRuns)
			.toEqual(['bad', 'later'])

		const setRuns: unknown[] = []
		const setResult = v.set(v.unknown().transform((value) => {
			setRuns.push(value)
			if (value === 'bad')
				throw new Error('bad')
			return value
		}), { collectAllIssues: true })
			.execute(new Set(['bad', 'later']))
		expect(issueCodes(setResult))
			.toEqual(['transform:callback_failed'])
		expect(setRuns)
			.toEqual(['bad', 'later'])
	})

	it('map stops before the value and later entries after a key failure by default', () => {
		const keyRuns: unknown[] = []
		const valueRuns: unknown[] = []
		const result = v.map({
			key: v.unknown().transform((value) => {
				keyRuns.push(value)
				if (value === 'bad')
					throw new Error('bad')
				return value
			}),
			value: v.unknown().transform((value) => {
				valueRuns.push(value)
				return value
			}),
		})
			.execute(new Map([['bad', 1], ['later', 2]]))
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed'])
		expect(keyRuns)
			.toEqual(['bad'])
		expect(valueRuns)
			.toEqual([])
	})

	it('map validates values and later entries when collection is enabled', () => {
		const keyRuns: unknown[] = []
		const valueRuns: unknown[] = []
		const result = v.map({
			key: v.unknown().transform((value) => {
				keyRuns.push(value)
				if (value === 'bad')
					throw new Error('bad')
				return value
			}),
			value: v.unknown().transform((value) => {
				valueRuns.push(value)
				return value
			}),
			collectAllIssues: true,
		})
			.execute(new Map([['bad', 1], ['later', 2]]))
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed'])
		expect(keyRuns)
			.toEqual(['bad', 'later'])
		expect(valueRuns)
			.toEqual([1, 2])
	})

	it('intersection stops later synchronous branches by default', () => {
		const later = vi.fn()
		const result = v.intersection([
			v.unknown().transform(() => { throw new Error('first') }),
			v.unknown().transform((value) => { later(); return value }),
		])
			.execute('value')
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed'])
		expect(later).not.toHaveBeenCalled()
	})

	it('intersection collects synchronous branch failures when enabled', () => {
		const later = vi.fn()
		const result = v.intersection([
			v.unknown().transform(() => { throw new Error('first') }),
			v.unknown().transform(() => { later(); throw new Error('second') }),
		], { collectAllIssues: true })
			.execute('value')
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed', 'transform:callback_failed'])
		expect(later).toHaveBeenCalledTimes(1)
	})

	it('intersection truly short-circuits asynchronous branches by default', async () => {
		const later = vi.fn()
		const result = await v.intersection([
			v.unknown().transform(async () => { throw new Error('first') }),
			v.unknown().transform((value) => { later(); return value }),
		])
			.execute('value')
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed'])
		expect(later).not.toHaveBeenCalled()
	})

	it('intersection starts remaining asynchronous branches when collection is enabled', async () => {
		const later = vi.fn()
		const result = await v.intersection([
			v.unknown().transform(async () => { throw new Error('first') }),
			v.unknown().transform(async () => { later(); throw new Error('second') }),
		], { collectAllIssues: true })
			.execute('value')
		expect(issueCodes(result))
			.toEqual(['transform:callback_failed', 'transform:callback_failed'])
		expect(later).toHaveBeenCalledTimes(1)
	})
})