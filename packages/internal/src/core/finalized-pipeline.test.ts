import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, Next, TStepPluginDef } from './types'
import { describe, expect, it, vi } from 'vitest'
import { createValchecker, executeRuntimeSteps, implStepPlugin } from './core'

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
	countRuns: DefineStepMethod<
		PipelineMeta,
		this['CurrentValchecker'] extends infer This extends PipelineMeta['ExpectedCurrentValchecker']
			? (onRun: () => void) => Next<undefined, This>
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
	countRuns: ({ utils, params: [onRun] }: any) => {
		utils.addStep((result: ExecutionResult) => {
			onRun()
			return result
		}, 'sync')
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

	// Both loops hand the remaining steps to a promise chain once a step turns
	// asynchronous, and both start that chain at the step *after* the one that did.
	// Starting it anywhere earlier re-runs work that already ran, which the value alone
	// cannot show for an idempotent step — hence the run counter.
	it('does not re-run the steps before the one that turned asynchronous', async () => {
		const before = vi.fn()
		const v = createValchecker({ steps: [pipelinePlugin] }) as any
		const schema = v.countRuns(before)
			.asyncIncrement(1)
			.multiply(2)

		await expect(schema.execute(4)).resolves.toEqual({ value: 10 })
		expect(before)
			.toHaveBeenCalledTimes(1)
	})

	it('does not re-run earlier steps when a lazily-resolved sub-pipeline turns asynchronous', async () => {
		const before = vi.fn()
		const steps = [
			(result: ExecutionResult) => {
				before()
				return result
			},
			async (result: ExecutionResult) => result,
			(result: ExecutionResult) => ({ value: (result as { value: number }).value * 2 }),
		]

		// `generic` reaches this loop directly rather than through a finalized pipeline,
		// so the same contract needs asserting against the exported function.
		await expect(executeRuntimeSteps(steps, { value: 5 })).resolves.toEqual({ value: 10 })
		expect(before)
			.toHaveBeenCalledTimes(1)
	})
})
