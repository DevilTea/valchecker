import type { AnyFn, MaybePromise } from '../shared'
import type {
	ExecutionFailureResult,
	ExecutionIssue,
	ExecutionResult,
	ExecutionSuccessResult,
	InferAllIssue,
	InitialValchecker,
	MessageHandler,
	StepMethodUtils,
	StepPluginImpl,
	TStepPluginDef,
} from './types'
import { runtimeExecutionStepDefMarker } from '../shared'

/* @__NO_SIDE_EFFECTS__ */
export function implStepPlugin<StepPluginDef extends TStepPluginDef>(stepImpl: StepPluginImpl<StepPluginDef>): StepPluginImpl<StepPluginDef> {
	(stepImpl as any)[runtimeExecutionStepDefMarker] = true
	return stepImpl
}

/* @__NO_SIDE_EFFECTS__ */
export function isSuccess(result: ExecutionResult): result is ExecutionSuccessResult<any> {
	return 'value' in result
}

/* @__NO_SIDE_EFFECTS__ */
export function isFailure(result: ExecutionResult): result is ExecutionFailureResult<any> {
	return 'issues' in result
}

/* @__NO_SIDE_EFFECTS__ */
export function prependIssuePath(issue: ExecutionIssue, path: ExecutionIssue['path']): ExecutionIssue {
	if (path == null || path.length === 0) {
		return issue
	}
	// Optimize: Avoid spread operator and Array.from for better performance
	const existingPath = issue.path
	if (existingPath == null || existingPath.length === 0) {
		(issue as any).path = path
	}
	else {
		// Direct array allocation with known length is faster
		const pathLen = path.length
		const existingLen = existingPath.length
		const newPath = Array.from({ length: pathLen + existingLen })
		for (let i = 0; i < pathLen; i++) {
			newPath[i] = path[i]
		}
		for (let i = 0; i < existingLen; i++) {
			newPath[pathLen + i] = existingPath[i]
		}
		(issue as any).path = newPath
	}
	return issue
}

/* @__NO_SIDE_EFFECTS__ */
export function handleMessage(
	{
		code,
		payload,
		path = [],
	}: {
		code: string
		payload: any
		path?: PropertyKey[]
	},
	message?: MessageHandler<any> | undefined | null,
): string | undefined | null {
	if (message == null || typeof message === 'string')
		return message
	return message({ code, payload, path })
}

/* @__NO_SIDE_EFFECTS__ */
export function resolveMessagePriority(
	issueContent: {
		code: string
		payload: any
		path?: PropertyKey[]
	},
	customMessage: MessageHandler<any> | undefined | null,
	defaultMessage: MessageHandler<any> | undefined | null,
	globalMessage: MessageHandler<any> | undefined,
): string {
	const customMsg = handleMessage(issueContent, customMessage)
	if (customMsg != null)
		return customMsg
	const defaultMsg = handleMessage(issueContent, defaultMessage)
	if (defaultMsg != null)
		return defaultMsg
	const globalMsg = handleMessage(issueContent, globalMessage)
	if (globalMsg != null)
		return globalMsg
	return 'Invalid value.'
}

/* @__NO_SIDE_EFFECTS__ */
export function createPipeExecutor(
	runtimeSteps: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[],
): (value: unknown) => MaybePromise<ExecutionResult> {
	return (value: unknown) => {
		// Optimized: Direct execution without Pipe overhead
		const len = runtimeSteps.length
		let result: any = { value } as ExecutionResult

		for (let i = 0; i < len; i++) {
			// Check if current result is a promise
			if (result instanceof Promise) {
				// Once we hit async, chain all remaining steps
				for (let j = i; j < len; j++) {
					result = result.then(runtimeSteps[j])
				}
				return result
			}
			// Execute step synchronously
			result = runtimeSteps[i]!(result)
		}
		return result
	}
}
/* @__NO_SIDE_EFFECTS__ */
function createExecutionStepMethodUtils(
	method: string,
	runtimeExecutions: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[],
	globalMessage?: MessageHandler<any>,
): StepMethodUtils<any, any, any> {
	const wrapWithErrorHandling = (
		fn: (lastResult: ExecutionResult) => MaybePromise<ExecutionResult>,
	) => (lastResult: ExecutionResult) => {
		const failure = (error: unknown) => ({
			issues: [{
				code: 'core:unknown_exception',
				payload: { method, value: lastResult, error },
				message: 'An unexpected error occurred during step execution',
			}],
		})
		try {
			const r = fn(lastResult)
			return r instanceof Promise
				? r.catch(error => failure(error))
				: r
		}
		catch (error) {
			return failure(error)
		}
	}

	return {
		addStep: fn => runtimeExecutions.push(wrapWithErrorHandling(fn)),
		addSuccessStep: fn => runtimeExecutions.push(wrapWithErrorHandling(result => isSuccess(result) ? fn(result.value) : result)),
		addFailureStep: fn => runtimeExecutions.push(wrapWithErrorHandling(result => isFailure(result) ? fn(result.issues) : result)),
		isSuccess,
		isFailure,
		prependIssuePath,
		resolveMessage: (...params) => resolveMessagePriority(...params, globalMessage),
		success: value => ({ value }),
		failure: issueOrIssues => ({ issues: [issueOrIssues].flat() }),
		issue: content => content,
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createProxyHandler(
	stepMethods: Record<PropertyKey, unknown>,
	globalMessage: MessageHandler<any> | undefined,
	runtimeSteps: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[],
) {
	return {
		get: (target: any, p: PropertyKey, receiver: any) => {
			if (Object.hasOwn(stepMethods, p) === false)
				return Reflect.get(target, p, receiver)

			const stepMethod = stepMethods[p] as AnyFn
			return (...params: any[]) => {
				const newInstance = createInstance(
					stepMethods,
					globalMessage,
					runtimeSteps,
				)
				stepMethod({
					utils: createExecutionStepMethodUtils(
						p as string,
						newInstance['~core'].runtimeSteps,
						globalMessage,
					),
					params,
				})
				return newInstance
			}
		},
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createCoreProperties(
	runtimeSteps: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[],
	execute: (value: unknown) => MaybePromise<ExecutionResult>,
) {
	return {
		'~standard': {
			version: 1,
			vendor: 'valchecker',
			validate: execute,
		},
		'~core': {
			executionStepContext: null!,
			RegisteredStepPluginDefs: null!,
			get runtimeSteps() {
				return runtimeSteps
			},
		},
		'~execute': execute,
		execute,
		isSuccess,
		isFailure,
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createInstance(
	stepMethods: Record<PropertyKey, unknown>,
	globalMessage: MessageHandler<any> | undefined,
	currentRuntimeSteps: ((lastResult: ExecutionResult) => MaybePromise<ExecutionResult>)[],
): any {
	const runtimeSteps = [...currentRuntimeSteps]
	const execute = createPipeExecutor(runtimeSteps)
	const coreProperties = createCoreProperties(runtimeSteps, execute)

	return new Proxy(coreProperties, createProxyHandler(stepMethods, globalMessage, runtimeSteps))
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
	const stepMethods = steps.reduce((acc, def) => {
		return ({ ...acc, ...def })
	}, {} as Record<PropertyKey, unknown>)

	return createInstance(
		stepMethods,
		globalMessage as any,
		[],
	) as InitialValchecker<NonNullable<ExecutionSteps[number]['~def']>>
}
