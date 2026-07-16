import type { ExecutionResult } from './types'
import { describe, expect, it } from 'vitest'
import { createPipeExecutor, handleMessage } from './core'

describe('specialized core pipelines', () => {
	it('continues a long pipeline when the first step is asynchronous', async () => {
		const executor = createPipeExecutor({
			runtimeSteps: [
				async result => ({ value: (result as any).value + 1 }),
				result => ({ value: (result as any).value * 2 }),
				result => ({ value: (result as any).value + 3 }),
			] as ((lastResult: ExecutionResult) => ExecutionResult | Promise<ExecutionResult>)[],
		})

		await expect(executor(2))
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
