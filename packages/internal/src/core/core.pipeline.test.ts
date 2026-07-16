import type { ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it } from 'vitest'
import { createPipeExecutor, createValchecker, handleMessage } from './core'

describe('specialized core pipelines', () => {
	it('keeps the exported pipe executor dynamic when its step array changes', () => {
		const runtimeSteps = [
			(result: ExecutionResult) => ({ value: (result as any).value + 1 }),
		]
		const executor = createPipeExecutor({ runtimeSteps })

		expect(executor(2))
			.toEqual({ value: 3 })

		runtimeSteps.push(result => ({ value: (result as any).value * 2 }))
		expect(executor(2))
			.toEqual({ value: 6 })
	})

	it('continues a finalized long schema pipeline when the first step is asynchronous', async () => {
		const pipelinePlugin = {
			pipeline: ({ utils }: any) => {
				utils.addStep(async (result: ExecutionResult) => ({ value: (result as any).value + 1 }))
				utils.addStep((result: ExecutionResult) => ({ value: (result as any).value * 2 }))
				utils.addStep((result: ExecutionResult) => ({ value: (result as any).value + 3 }))
			},
		} as unknown as StepPluginImpl<TStepPluginDef>
		const v = createValchecker({ steps: [pipelinePlugin] })
		const schema = (v as any).pipeline()

		await expect(schema.execute(2))
			.resolves.toEqual({ value: 9 })
	})

	it('ignores an own message-map entry that is not a function', () => {
		expect(handleMessage({
			code: 'test:error',
			payload: {},
			path: [],
		}, { 'test:error': 'not-a-handler' } as any))
			.toBeNull()
	})
})
