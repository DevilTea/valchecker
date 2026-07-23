import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, Next, TStepPluginDef } from './types'
import { describe, expect, it } from 'vitest'
import { createValchecker, implStepPlugin } from './core'

type PipelineMeta = DefineStepMethodMeta<{
	Name: 'pipeline'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PipelineDef extends TStepPluginDef {
	asyncIncrement: DefineStepMethod<
		PipelineMeta,
		this['CurrentValchecker'] extends infer This extends PipelineMeta['ExpectedCurrentValchecker']
			? (amount: number) => Next<{ output: number }, This>
			: never
	>
	multiply: DefineStepMethod<
		PipelineMeta,
		this['CurrentValchecker'] extends infer This extends PipelineMeta['ExpectedCurrentValchecker']
			? (factor: number) => Next<{ output: number }, This>
			: never
	>
	inspect: DefineStepMethod<
		PipelineMeta,
		this['CurrentValchecker'] extends infer This extends PipelineMeta['ExpectedCurrentValchecker']
			? () => Next<undefined, This>
			: never
	>
}

const pipelinePlugin = implStepPlugin<PipelineDef>({
	asyncIncrement: ({ utils, params: [amount] }: any) => {
		utils.addSuccessStep(async (value: number) => utils.success(value + amount))
	},
	multiply: ({ utils, params: [factor] }: any) => {
		utils.addSuccessStep((value: number) => utils.success(value * factor))
	},
	inspect: ({ utils }: any) => {
		utils.addStep((result: ExecutionResult) => result)
	},
})

describe('finalized pipeline contracts', () => {
	it('continues every later step when the first of three steps is asynchronous', async () => {
		const v = createValchecker({ steps: [pipelinePlugin] }) as any
		const schema = v.asyncIncrement(1)
			.multiply(2)
			.inspect()
		const result = schema.execute(4)

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 10 })
	})
})
