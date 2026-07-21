import type { ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it } from 'vitest'
import { bigint } from '../steps/bigint'
import { boolean } from '../steps/boolean'
import { check } from '../steps/check'
import { number } from '../steps/number'
import { object } from '../steps/object'
import { string } from '../steps/string'
import { transform } from '../steps/transform'
import { createValchecker, implStepPlugin } from './core'
import { conservativeExecutionEffects, getExecutionEffects, neutralExecutionEffects, preserveExecutionEffects } from './execution-effects'

const passthrough = implStepPlugin({
	passthrough: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => result, 'sync')
	},
} as any) as StepPluginImpl<TStepPluginDef>

const preserveIdentityOnly = implStepPlugin({
	preserveIdentityOnly: ({ utils }: any) => {
		preserveExecutionEffects(utils, { identity: 'may-transform' })
		utils.addStep((result: ExecutionResult) => result, 'sync')
	},
} as any) as StepPluginImpl<TStepPluginDef>

const v = createValchecker({
	steps: [
		string,
		number,
		boolean,
		bigint,
		object,
		check,
		transform,
		passthrough,
		preserveIdentityOnly,
	],
}) as any

describe('execution effect metadata', () => {
	it('keeps the empty pipeline neutral and metadata-free steps conservative', () => {
		const schema = v.string()

		expect(getExecutionEffects(v)).toEqual(neutralExecutionEffects)
		expect(getExecutionEffects(v.passthrough())).toEqual(conservativeExecutionEffects)
		expect(getExecutionEffects(schema.passthrough())).toEqual(conservativeExecutionEffects)
		expect(schema['~executionEffects']).toBeUndefined()
		expect(Object.keys(schema)).not.toContain('~executionEffects')
	})

	it.each([
		['string', v.string()],
		['number', v.number()],
		['boolean', v.boolean()],
		['bigint', v.bigint()],
	])('marks the %s initial schema as direct and identity-preserving', (_name, schema) => {
		expect(getExecutionEffects(schema)).toEqual(neutralExecutionEffects)
	})

	it('preserves unspecified effects in a partial trusted annotation', () => {
		expect(getExecutionEffects(v.string().preserveIdentityOnly())).toEqual({
			identity: 'may-transform',
			parentTraversal: 'direct-safe',
			structuralOutput: null,
		})
	})

	it('does not let a later classifier recover guarantees lost by an earlier step', () => {
		const schema = v.string().transform(() => 'transformed').string()

		expect(getExecutionEffects(schema)).toEqual(conservativeExecutionEffects)
	})

	it('records known fresh ordinary-object output', () => {
		const schema = v.object({ left: v.string(), right: v.number() })

		expect(getExecutionEffects(schema)).toEqual({
			identity: 'may-transform',
			parentTraversal: 'direct-safe',
			structuralOutput: {
				kind: 'fresh-ordinary-object',
				keys: ['left', 'right'],
			},
		})
	})

	it('propagates traversal safety from the previous pipeline and structural children', () => {
		const unsafeChild = v.object({ value: v.string().check(() => true) })
		const unsafePrevious = v.string().check(() => true).object({ value: v.string() })

		expect(getExecutionEffects(unsafeChild).parentTraversal).toBe('snapshot-required')
		expect(getExecutionEffects(unsafePrevious).parentTraversal).toBe('snapshot-required')
	})

	it('preserves the existing identity classification while invalidating structural guarantees', () => {
		const schema = v.object({ value: v.string() }).check((value: Record<string, unknown>) => {
			value.extra = true
			return true
		})
		const effects = getExecutionEffects(schema)

		expect(effects.identity).toBe('may-transform')
		expect(effects.parentTraversal).toBe('snapshot-required')
		expect(effects.structuralOutput).toBeNull()
	})

	it('invalidates structural and identity guarantees after arbitrary transforms', () => {
		const schema = v.object({ value: v.string() }).transform((value: unknown) => value)

		expect(getExecutionEffects(schema)).toEqual(conservativeExecutionEffects)
	})
})
