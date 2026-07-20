import type { AnyFn, MaybePromise } from '../shared'
import type {
	ExecutionFailureResult,
	ExecutionResult,
	InferAllIssue,
	InitialValchecker,
	MessageHandler,
	StepPluginImpl,
	TStepPluginDef,
} from './types'
import { isPromiseLike, runtimeExecutionStepDefMarker } from '../shared'
import {
	createValchecker as createLegacyValchecker,
	implStepPlugin,
	isFailure,
	isSuccess,
} from './core'

type RuntimeStep = (lastResult: ExecutionResult) => MaybePromise<ExecutionResult>
type PipeExecutor = (value: unknown) => MaybePromise<ExecutionResult>

interface RuntimeStepNode {
	readonly parent?: RuntimeStepNode | undefined
	readonly segment: readonly RuntimeStep[]
	readonly length: number
	runtimeSteps?: RuntimeStep[] | undefined
}

const emptyRuntimeSteps = Object.freeze([]) as RuntimeStep[]
const emptyRuntimeStepNode: RuntimeStepNode = {
	segment: emptyRuntimeSteps,
	length: 0,
	runtimeSteps: emptyRuntimeSteps,
}

function appendRuntimeStepNode(
	parent: RuntimeStepNode,
	segment: readonly RuntimeStep[],
): RuntimeStepNode {
	if (segment.length === 0)
		return parent
	return {
		parent,
		segment,
		length: parent.length + segment.length,
	}
}

function materializeRuntimeSteps(node: RuntimeStepNode): RuntimeStep[] {
	if (node.runtimeSteps != null)
		return node.runtimeSteps

	// eslint-disable-next-line unicorn/no-new-array
	const runtimeSteps = new Array<RuntimeStep>(node.length)
	let offset = node.length
	let current: RuntimeStepNode | undefined = node
	while (current != null && current.length > 0) {
		const segment = current.segment
		offset -= segment.length
		for (let index = 0; index < segment.length; index++)
			runtimeSteps[offset + index] = segment[index]!
		current = current.parent
	}
	Object.freeze(runtimeSteps)
	node.runtimeSteps = runtimeSteps
	return runtimeSteps
}

function createFinalizedPipeExecutor(runtimeSteps: RuntimeStep[]): PipeExecutor {
	const len = runtimeSteps.length
	if (len === 0)
		return value => ({ value })

	const first = runtimeSteps[0]!
	if (len === 1)
		return value => first({ value })

	if (len === 2) {
		const second = runtimeSteps[1]!
		return (value) => {
			const result = first({ value })
			return isPromiseLike(result)
				? Promise.resolve(result).then(second)
				: second(result)
		}
	}

	return (value) => {
		let result = first({ value })
		if (isPromiseLike(result)) {
			let chain = Promise.resolve(result)
			for (let index = 1; index < len; index++)
				chain = chain.then(runtimeSteps[index]!)
			return chain
		}

		for (let index = 1; index < len; index++) {
			result = runtimeSteps[index]!(result)
			if (isPromiseLike(result)) {
				let chain = Promise.resolve(result)
				for (let nextIndex = index + 1; nextIndex < len; nextIndex++)
					chain = chain.then(runtimeSteps[nextIndex]!)
				return chain
			}
		}
		return result
	}
}

function createPublicExecutor(
	executeRaw: PipeExecutor,
	finalizeFailure: (result: ExecutionFailureResult<any>) => ExecutionResult,
): PipeExecutor {
	const finalizeResult = (result: ExecutionResult): ExecutionResult => isFailure(result)
		? finalizeFailure(result)
		: result

	return (value) => {
		const result = executeRaw(value)
		return isPromiseLike(result)
			? Promise.resolve(result).then(finalizeResult)
			: finalizeResult(result)
	}
}

function collectStepMethodNames(steps: readonly StepPluginImpl<any>[]): Set<PropertyKey> {
	const methods = new Set<PropertyKey>()
	for (const definition of steps) {
		for (const method of Reflect.ownKeys(definition)) {
			if (method !== runtimeExecutionStepDefMarker)
				methods.add(method)
		}
	}
	return methods
}

function createInternalMethodName(methods: ReadonlySet<PropertyKey>): string {
	let method = '\0valchecker.finalizePipeline'
	while (methods.has(method))
		method += '\0'
	return method
}

function createFinalizerPlugin(method: string): StepPluginImpl<any> {
	return implStepPlugin({
		[method]: ({
			utils: { addSuccessStep },
		}: any) => {
			addSuccessStep((value: ExecutionResult) => value)
		},
	} as any)
}

function createCoreProperties({
	runtimeStepNode,
	finalizeFailure,
}: {
	runtimeStepNode: RuntimeStepNode
	finalizeFailure: (result: ExecutionFailureResult<any>) => ExecutionResult
}) {
	let executeRaw: PipeExecutor | undefined
	let execute: PipeExecutor | undefined
	const getExecuteRaw = (): PipeExecutor => {
		executeRaw ??= createFinalizedPipeExecutor(materializeRuntimeSteps(runtimeStepNode))
		return executeRaw
	}
	const getExecute = (): PipeExecutor => {
		execute ??= createPublicExecutor(getExecuteRaw(), finalizeFailure)
		return execute
	}

	const standardProperties: Record<PropertyKey, unknown> = {
		version: 1,
		vendor: 'valchecker',
	}
	Object.defineProperty(standardProperties, 'validate', {
		configurable: true,
		enumerable: true,
		get: () => {
			const validate = getExecute()
			Object.defineProperty(standardProperties, 'validate', {
				configurable: true,
				enumerable: true,
				value: validate,
				writable: true,
			})
			return validate
		},
	})

	const coreProperties: Record<PropertyKey, unknown> = {
		'~standard': standardProperties,
		'~core': {
			executionStepContext: null!,
			RegisteredStepPluginDefs: null!,
			get runtimeSteps() {
				return materializeRuntimeSteps(runtimeStepNode)
			},
		},
	}
	Object.defineProperty(coreProperties, '~execute', {
		configurable: true,
		enumerable: true,
		get: () => {
			const value = getExecuteRaw()
			Object.defineProperty(coreProperties, '~execute', {
				configurable: true,
				enumerable: true,
				value,
				writable: true,
			})
			return value
		},
	})
	Object.defineProperty(coreProperties, 'execute', {
		configurable: true,
		enumerable: true,
		get: () => {
			const value = getExecute()
			Object.defineProperty(coreProperties, 'execute', {
				configurable: true,
				enumerable: true,
				value,
				writable: true,
			})
			return value
		},
	})
	coreProperties.isSuccess = isSuccess
	coreProperties.isFailure = isFailure
	return coreProperties
}

function createInstance({
	legacyRoot,
	stepMethodNames,
	finalizeFailure,
	currentRuntimeStepNode,
}: {
	legacyRoot: any
	stepMethodNames: ReadonlySet<PropertyKey>
	finalizeFailure: (result: ExecutionFailureResult<any>) => ExecutionResult
	currentRuntimeStepNode: RuntimeStepNode
}): any {
	const coreProperties = createCoreProperties({
		runtimeStepNode: currentRuntimeStepNode,
		finalizeFailure,
	})

	return new Proxy(coreProperties, {
		get: (target: any, property: PropertyKey, receiver: any) => {
			if (!stepMethodNames.has(property))
				return Reflect.get(target, property, receiver)

			const stepMethod = Reflect.get(legacyRoot, property) as AnyFn
			return (...params: any[]) => {
				const segmentSchema = stepMethod(...params)
				const segment = segmentSchema['~core'].runtimeSteps as readonly RuntimeStep[]
				return createInstance({
					legacyRoot,
					stepMethodNames,
					finalizeFailure,
					currentRuntimeStepNode: appendRuntimeStepNode(currentRuntimeStepNode, segment),
				})
			}
		},
	})
}

/* @__NO_SIDE_EFFECTS__ */
export function createValchecker<
	ExecutionSteps extends StepPluginImpl<any>[],
>({
	steps,
	message: globalMessage,
}: {
	steps: [...ExecutionSteps]
	message?: MessageHandler<
		| InferAllIssue<{
			'~core': {
				executionStepContext: any
				registeredExecutionStepPlugins: NonNullable<NoInfer<ExecutionSteps>[number]['~def']>
			}
		}>
	>
}) {
	const stepMethodNames = collectStepMethodNames(steps)
	const finalizerMethod = createInternalMethodName(stepMethodNames)
	const finalizerPlugin = createFinalizerPlugin(finalizerMethod)
	const legacyRoot = createLegacyValchecker({
		steps: [...steps, finalizerPlugin] as any,
		message: globalMessage as any,
	}) as any
	const finalizerSchema = Reflect.get(legacyRoot, finalizerMethod)()
	const finalizeFailure = (result: ExecutionFailureResult<any>): ExecutionResult => finalizerSchema.execute(result) as ExecutionResult

	return createInstance({
		legacyRoot,
		stepMethodNames,
		finalizeFailure,
		currentRuntimeStepNode: emptyRuntimeStepNode,
	}) as InitialValchecker<NonNullable<ExecutionSteps[number]['~def']>>
}
