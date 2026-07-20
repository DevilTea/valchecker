import type { StepPluginImpl, TStepPluginDef } from './types'
import { expect, it } from 'vitest'
import { createValchecker as createLegacyValchecker, implStepPlugin } from './core'
import { createValchecker } from './persistentCore'

const arithmeticPlugin = implStepPlugin({
	increment: ({ utils, params: [amount = 1] }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value + amount))
	},
	incrementTwice: ({ utils, params: [first = 1, second = 1] }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value + first))
		utils.addSuccessStep((value: number) => utils.success(value + second))
	},
	incrementAsync: ({ utils, params: [amount = 1] }: any) => {
		utils.addSuccessStep(async (value: number) => utils.success(value + amount))
	},
} as any) as StepPluginImpl<TStepPluginDef>

it('materializes persistent pipeline segments in order without mutating parent schemas', () => {
	const v = createValchecker({ steps: [arithmeticPlugin] }) as any
	const first = v.increment(2)
	const chained = first.incrementTwice(3, 4)

	const runtimeSteps = chained['~core'].runtimeSteps
	expect(runtimeSteps).toHaveLength(3)
	expect(Object.isFrozen(runtimeSteps)).toBe(true)
	expect(chained['~core'].runtimeSteps).toBe(runtimeSteps)
	expect(first['~core'].runtimeSteps).toHaveLength(1)
	expect(v['~core'].runtimeSteps).toHaveLength(0)

	expect(v.execute(1)).toEqual({ value: 1 })
	expect(first.execute(1)).toEqual({ value: 3 })
	expect(chained.execute(1)).toEqual({ value: 10 })
})

it('caches specialized raw and public executors while preserving Standard Schema identity', () => {
	const v = createValchecker({ steps: [arithmeticPlugin] }) as any
	const schema = v.increment(2).incrementTwice(3, 4)

	const executeRaw = schema['~execute']
	const execute = schema.execute
	const validate = schema['~standard'].validate

	expect(schema['~execute']).toBe(executeRaw)
	expect(schema.execute).toBe(execute)
	expect(validate).toBe(execute)
	expect(schema['~standard'].validate).toBe(validate)
	expect(executeRaw(1)).toEqual({ value: 10 })
	expect(execute(1)).toEqual({ value: 10 })
})

it('continues two-step and longer pipelines after an async first step', async () => {
	const v = createValchecker({ steps: [arithmeticPlugin] }) as any

	await expect(v.incrementAsync(2).increment(3).execute(1)).resolves.toEqual({ value: 6 })
	await expect(v.incrementAsync(2).incrementTwice(3, 4).execute(1)).resolves.toEqual({ value: 10 })
})

it('preserves legacy continuation when a later step becomes async', async () => {
	const v = createLegacyValchecker({ steps: [arithmeticPlugin] }) as any
	const schema = v.increment(1).incrementAsync(2).increment(3)

	await expect(schema.execute(1)).resolves.toEqual({ value: 7 })
})

it('avoids collisions with a registered internal finalizer method name', () => {
	const finalizerName = '\0valchecker.finalizePipeline'
	const collisionPlugin = implStepPlugin({
		[finalizerName]: ({ utils }: any) => {
			utils.addSuccessStep((value: unknown) => utils.success(value))
		},
	} as any) as StepPluginImpl<TStepPluginDef>
	const v = createValchecker({ steps: [collisionPlugin] }) as any

	expect(Reflect.get(v, finalizerName)().execute('value')).toEqual({ value: 'value' })
})
