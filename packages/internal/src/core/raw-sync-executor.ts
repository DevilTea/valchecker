import type { ExecutionResult, Use, Valchecker } from './types'

type SyncRuntimeStep = (lastResult: ExecutionResult) => ExecutionResult
export type RawSyncExecutor = (value: unknown) => ExecutionResult

const executorCache = new WeakMap<object, RawSyncExecutor>()

export function createRawSyncExecutor(runtimeSteps: readonly unknown[]): RawSyncExecutor {
	const steps = runtimeSteps as readonly SyncRuntimeStep[]
	const len = steps.length
	if (len === 0)
		return value => ({ value })

	const first = steps[0]!
	if (len === 1)
		return value => first({ value })

	if (len === 2) {
		const second = steps[1]!
		return value => second(first({ value }))
	}

	return (value) => {
		let result = first({ value })
		for (let i = 1; i < len; i++)
			result = steps[i]!(result)
		return result
	}
}

export function getStructuralRawSyncExecutor(schema: Use<Valchecker>): RawSyncExecutor {
	const cached = executorCache.get(schema)
	if (cached != null)
		return cached

	const executor = createRawSyncExecutor(schema['~core'].runtimeSteps)
	executorCache.set(schema, executor)
	return executor
}
