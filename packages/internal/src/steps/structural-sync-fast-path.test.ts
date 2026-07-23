import type { ExecutionResult, Use, Valchecker } from '../core'
import { describe, expect, it } from 'vitest'
import { array, intersection, looseObject, map, object, set, strictObject, union, variant } from '.'
import { createValchecker } from '../core'

const v = createValchecker({
	steps: [array, object, looseObject, strictObject, map, set, variant, union, intersection],
})

function createSynchronousFixture(
	transform: (value: unknown) => unknown = value => value,
): Use<Valchecker> {
	return {
		'~core': { operationMode: 'sync' },
		'~execute': (value: unknown) => {
			const result: ExecutionResult = { value: transform(value) }
			let thenReads = 0
			Object.defineProperty(result, 'then', {
				get() {
					thenReads++
					if (thenReads > 1)
						throw new Error('A fully synchronous child result must not be inspected as a thenable.')
					return undefined
				},
			})
			return result
		},
	} as unknown as Use<Valchecker>
}

describe('synchronous structural child result handling', () => {
	it('skips thenable inspection for collection children', () => {
		const identity = createSynchronousFixture()
		const doubled = createSynchronousFixture(value => (value as number) * 2)

		expect(v.array(doubled)
			.execute([1, 2]))
			.toEqual({ value: [2, 4] })
		expect(v.set(doubled)
			.execute(new Set([1, 2])))
			.toEqual({ value: new Set([2, 4]) })
		expect(v.map({ key: identity, value: doubled })
			.execute(new Map([['a', 1]])))
			.toEqual({ value: new Map([['a', 2]]) })
	})

	it('skips thenable inspection for object children', () => {
		const upper = createSynchronousFixture(value => String(value)
			.toUpperCase())
		const input = { value: 'a', extra: true }

		expect(v.object({ value: upper })
			.execute(input))
			.toEqual({ value: { value: 'A' } })
		expect(v.looseObject({ value: upper })
			.execute(input))
			.toEqual({ value: { value: 'A', extra: true } })
		expect(v.strictObject({ value: upper })
			.execute({ value: 'a' }))
			.toEqual({ value: { value: 'A' } })
	})

	it('skips thenable inspection for combinator branches', () => {
		const identity = createSynchronousFixture()
		const variantBranch = createSynchronousFixture(value => ({ ...(value as object), selected: true }))

		expect(v.union([identity])
			.execute('value'))
			.toEqual({ value: 'value' })
		expect(v.intersection([identity, identity])
			.execute('value'))
			.toEqual({ value: 'value' })
		expect(v.variant({
			discriminator: 'type',
			variants: { selected: variantBranch },
		})
			.execute({ type: 'selected' }))
			.toEqual({ value: { type: 'selected', selected: true } })
	})
})
