import type { AnyFn, MaybePromise, MaybePromiseLike } from '../shared'
import type {
	AnyExecutionIssue,
	CoreIssue,
	ExecutionFailureResult,
	ExecutionIssue,
	ExecutionResult,
	ExecutionSuccessResult,
	InferAllIssue,
	InitialValchecker,
	IssueCategory,
	IssueContext,
	MessageExceptionIssue,
	MessageHandler,
	ResolveMessageFn,
	StepMethodUtils,
	StepPluginImpl,
	TStepPluginDef,
} from './types'
import { isPromiseLike, runtimeExecutionStepDefMarker } from '../shared'

type RuntimeStep = (lastResult: ExecutionResult) => MaybePromise<ExecutionResult>
type PipeExecutor = (value: unknown) => MaybePromise<ExecutionResult>

type MessageData = {
	code: string
	category?: IssueCategory | undefined
	payload: unknown
	path: PropertyKey[]
	context?: IssueContext[] | undefined
}

type MessageSource = 'step' | 'context' | 'global' | 'default'

interface IssueDraftMetadata {
	resolveMessage: ResolveMessageFn
	customMessage?: MessageHandler<any> | undefined
	contextMessages: MessageHandler<any>[]
	defaultMessage?: MessageHandler<any> | undefined
}

class MessageResolutionError {
	constructor(
		readonly source: MessageSource,
		readonly error: unknown,
	) { }
}

const issueDraftMetadata = new WeakMap<object, IssueDraftMetadata>()

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
export function prependIssuePath<Issue extends AnyExecutionIssue>(
	issue: Issue,
	path: Issue['path'],
	messageScope?: MessageHandler<any> | undefined,
): Issue {
	const hasPath = path != null && path.length > 0
	const metadata = issueDraftMetadata.get(issue)
	const hasMessageScope = metadata != null && messageScope != null

	if (!hasPath && !hasMessageScope)
		return issue

	const existingPath = issue.path
	const nextIssue = {
		...issue,
		path: hasPath
			? existingPath == null || existingPath.length === 0
				? [...path]
				: [...path, ...existingPath]
			: existingPath,
	}

	if (metadata != null) {
		issueDraftMetadata.set(nextIssue, {
			...metadata,
			contextMessages: hasMessageScope
				? [...metadata.contextMessages, messageScope as MessageHandler<any>]
				: metadata.contextMessages,
		})
	}

	return nextIssue
}

function executeRuntimeSteps(runtimeSteps: RuntimeStep[], value: unknown): MaybePromise<ExecutionResult> {
	const len = runtimeSteps.length
	let result: MaybePromise<ExecutionResult> = { value }

	for (let i = 0; i < len; i++) {
		result = runtimeSteps[i]!(result as ExecutionResult)
		if (isPromiseLike(result)) {
			let chain = Promise.resolve(result)
			for (let j = i + 1; j < len; j++)
				chain = chain.then(runtimeSteps[j]!)
			return chain
		}
	}
	return result
}

/* @__NO_SIDE_EFFECTS__ */
export function createPipeExecutor({
	runtimeSteps,
}: {
	runtimeSteps: RuntimeStep[]
}): PipeExecutor {
	return value => executeRuntimeSteps(runtimeSteps, value)
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
			for (let i = 1; i < len; i++)
				chain = chain.then(runtimeSteps[i]!)
			return chain
		}

		for (let i = 1; i < len; i++) {
			result = runtimeSteps[i]!(result)
			if (isPromiseLike(result)) {
				let chain = Promise.resolve(result)
				for (let j = i + 1; j < len; j++)
					chain = chain.then(runtimeSteps[j]!)
				return chain
			}
		}
		return result
	}
}

function normalizeMessageData(data: MessageData): Required<Pick<MessageData, 'code' | 'category' | 'payload' | 'path'>> & Pick<MessageData, 'context'> {
	return {
		code: data.code,
		category: data.category ?? 'validation',
		payload: data.payload,
		path: data.path,
		context: data.context,
	}
}

/* @__NO_SIDE_EFFECTS__ */
export function handleMessage(
	data: MessageData,
	message?: MessageHandler<any> | undefined | null,
): string | undefined | null {
	if (message == null)
		return message
	if (typeof message === 'string')
		return message

	const normalizedData = normalizeMessageData(data)
	if (typeof message === 'function')
		return message(normalizedData as any)

	if (Object.hasOwn(message, data.code)) {
		const mappedMessage = (message as any)[data.code]
		if (typeof mappedMessage === 'function')
			return mappedMessage(normalizedData)
	}
	return null
}

function handleMessageSource(
	data: MessageData,
	message: MessageHandler<any> | undefined | null,
	source: MessageSource,
): string | undefined | null {
	try {
		return handleMessage(data, message)
	}
	catch (error) {
		throw new MessageResolutionError(source, error)
	}
}

/* @__NO_SIDE_EFFECTS__ */
export function resolveMessagePriority({
	data,
	customMessage,
	contextMessages = [],
	defaultMessage,
	globalMessage,
}: {
	data: MessageData
	customMessage: MessageHandler<any> | undefined | null
	contextMessages?: MessageHandler<any>[] | undefined
	defaultMessage: MessageHandler<any> | undefined | null
	globalMessage: MessageHandler<any> | undefined
}): string {
	const customMsg = handleMessageSource(data, customMessage, 'step')
	if (customMsg != null)
		return customMsg

	for (const contextMessage of contextMessages) {
		const contextMsg = handleMessageSource(data, contextMessage, 'context')
		if (contextMsg != null)
			return contextMsg
	}

	const globalMsg = handleMessageSource(data, globalMessage, 'global')
	if (globalMsg != null)
		return globalMsg

	const defaultMsg = handleMessageSource(data, defaultMessage, 'default')
	if (defaultMsg != null)
		return defaultMsg

	return 'Invalid value.'
}

/* @__NO_SIDE_EFFECTS__ */
function createResolveMessageFunction(
	globalMessage?: MessageHandler<any> | undefined,
): ResolveMessageFn {
	return ({
		data,
		customMessage,
		contextMessages,
		defaultMessage,
	}) => resolveMessagePriority({
		data,
		customMessage,
		contextMessages,
		defaultMessage,
		globalMessage,
	})
}

function getMessageData(issue: AnyExecutionIssue): MessageData {
	return {
		code: issue.code,
		category: issue.category,
		payload: issue.payload,
		path: issue.path,
		context: issue.context,
	}
}

function createMessageExceptionIssue(
	unresolvedIssue: AnyExecutionIssue,
	resolutionError: MessageResolutionError,
	resolveMessage: ResolveMessageFn,
): MessageExceptionIssue {
	const defaultMessage = 'An unexpected error occurred while resolving an issue message.'
	const issue: MessageExceptionIssue = {
		code: 'core:message_exception',
		category: 'internal',
		payload: {
			source: resolutionError.source,
			unresolvedIssue: getMessageData(unresolvedIssue) as MessageExceptionIssue['payload']['unresolvedIssue'],
			error: resolutionError.error,
		},
		message: defaultMessage,
		path: [...unresolvedIssue.path],
	}
	if (unresolvedIssue.context != null)
		issue.context = [...unresolvedIssue.context]

	try {
		issue.message = resolveMessage({
			data: getMessageData(issue) as any,
			defaultMessage,
		})
	}
	catch {
		// A message exception must always remain representable, even when the
		// global resolver also rejects the core issue used to report it.
	}

	return issue
}

function finalizeIssue(issue: AnyExecutionIssue): AnyExecutionIssue {
	const metadata = issueDraftMetadata.get(issue)
	if (metadata == null)
		return issue

	try {
		return {
			...issue,
			message: metadata.resolveMessage({
				data: getMessageData(issue) as any,
				customMessage: metadata.customMessage,
				contextMessages: metadata.contextMessages,
				defaultMessage: metadata.defaultMessage,
			}),
		}
	}
	catch (error) {
		const resolutionError = error instanceof MessageResolutionError
			? error
			: new MessageResolutionError('default', error)
		return createMessageExceptionIssue(issue, resolutionError, metadata.resolveMessage)
	}
}

function finalizeResult(result: ExecutionResult): ExecutionResult {
	if ('value' in result)
		return result

	const issues = result.issues
	return {
		issues: [
			finalizeIssue(issues[0]!),
			...issues.slice(1).map(finalizeIssue),
		],
	}
}

function createPublicExecutor(executeRaw: PipeExecutor): PipeExecutor {
	return (value) => {
		const result = executeRaw(value)
		return isPromiseLike(result)
			? Promise.resolve(result).then(finalizeResult)
			: finalizeResult(result)
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createUnknownExceptionFailure(
	method: string,
	lastResult: ExecutionResult,
	error: unknown,
	resolveMessage: ResolveMessageFn,
): ExecutionFailureResult<CoreIssue> {
	const issue: ExecutionIssue<
		'core:unknown_exception',
		{ method: string, receivedResult: ExecutionResult, error: unknown },
		'internal'
	> = {
		code: 'core:unknown_exception',
		category: 'internal',
		payload: { method, receivedResult: lastResult, error },
		message: 'Invalid value.',
		path: [],
	}
	issueDraftMetadata.set(issue, {
		resolveMessage,
		contextMessages: [],
		defaultMessage: 'An unexpected error occurred during step execution',
	})
	return { issues: [issue] }
}

/* @__NO_SIDE_EFFECTS__ */
function createExecutionStepMethodUtils(
	method: string,
	runtimeExecutions: RuntimeStep[],
	resolveMessage: ResolveMessageFn,
): StepMethodUtils<any, any, any, any> {
	const wrapWithErrorHandling = (
		fn: (lastResult: ExecutionResult) => MaybePromiseLike<ExecutionResult>,
	) => (lastResult: ExecutionResult) => {
		try {
			const result = fn(lastResult)
			return isPromiseLike(result)
				? Promise.resolve(result).catch(error => createUnknownExceptionFailure(method, lastResult, error, resolveMessage))
				: result
		}
		catch (error) {
			return createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
		}
	}

	return {
		addStep: fn => runtimeExecutions.push(wrapWithErrorHandling(fn)),
		addSuccessStep: fn => runtimeExecutions.push(wrapWithErrorHandling(result => 'value' in result ? fn(result.value) : result)),
		addFailureStep: fn => runtimeExecutions.push(wrapWithErrorHandling(result => 'issues' in result ? fn(result.issues) : result)),
		isSuccess,
		isFailure,
		prependIssuePath,
		success: value => ({ value }),
		failure: (issueOrIssues) => {
			const issues = Array.isArray(issueOrIssues) ? issueOrIssues : [issueOrIssues]
			if (issues.length === 0)
				throw new TypeError('A failure result requires at least one issue.')
			return { issues: issues as [AnyExecutionIssue, ...AnyExecutionIssue[]] }
		},
		createIssue: ({
			code,
			category = 'validation',
			payload,
			path = [],
			context,
			customMessage,
			defaultMessage,
		}: any) => {
			const issue: AnyExecutionIssue = {
				code,
				category,
				payload,
				path,
				message: 'Invalid value.',
			}
			if (context != null)
				issue.context = context
			issueDraftMetadata.set(issue, {
				resolveMessage,
				customMessage,
				contextMessages: [],
				defaultMessage,
			})
			return issue
		},
		issue: i => i,
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createProxyHandler({
	stepMethods,
	resolveMessage,
	runtimeSteps,
}: {
	stepMethods: Record<PropertyKey, unknown>
	resolveMessage: ResolveMessageFn
	runtimeSteps: RuntimeStep[]
}) {
	return {
		get: (target: any, p: PropertyKey, receiver: any) => {
			if (Object.hasOwn(stepMethods, p) === false)
				return Reflect.get(target, p, receiver)

			const stepMethod = stepMethods[p] as AnyFn
			return (...params: any[]) => {
				const nextRuntimeSteps = [...runtimeSteps]
				stepMethod({
					utils: createExecutionStepMethodUtils(
						p as string,
						nextRuntimeSteps,
						resolveMessage,
					),
					params,
				})
				return createInstance({
					stepMethods,
					resolveMessage,
					currentRuntimeSteps: nextRuntimeSteps,
				})
			}
		},
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createCoreProperties(
	runtimeSteps: RuntimeStep[],
	executeRaw: PipeExecutor,
) {
	const execute = createPublicExecutor(executeRaw)
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
		'~execute': executeRaw,
		execute,
		isSuccess,
		isFailure,
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createInstance({
	stepMethods,
	resolveMessage,
	currentRuntimeSteps,
}: {
	stepMethods: Record<PropertyKey, unknown>
	resolveMessage: ResolveMessageFn
	currentRuntimeSteps: RuntimeStep[]
}): any {
	const executeRaw = createFinalizedPipeExecutor(currentRuntimeSteps)
	const coreProperties = createCoreProperties(currentRuntimeSteps, executeRaw)

	return new Proxy(coreProperties, createProxyHandler({ stepMethods, resolveMessage, runtimeSteps: currentRuntimeSteps }))
}

const reservedStepMethodNames = new Set<PropertyKey>([
	'~standard',
	'~core',
	'~execute',
	'execute',
	'isSuccess',
	'isFailure',
	'then',
])

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
	const stepMethods = Object.create(null) as Record<PropertyKey, unknown>
	for (const def of steps) {
		for (const method of Reflect.ownKeys(def)) {
			if (method === runtimeExecutionStepDefMarker)
				continue
			if (typeof method !== 'string')
				throw new TypeError(`Invalid step method name: ${String(method)}`)
			if (reservedStepMethodNames.has(method))
				throw new TypeError(`Reserved step method: ${method}`)
			if (Object.hasOwn(stepMethods, method))
				throw new TypeError(`Duplicate step method: ${method}`)

			const stepMethod = Reflect.get(def, method)
			if (typeof stepMethod !== 'function')
				throw new TypeError(`Invalid step method: ${method}`)
			stepMethods[method] = stepMethod
		}
	}
	const resolveMessage = createResolveMessageFunction(globalMessage as MessageHandler<any> | undefined)

	return createInstance({
		stepMethods,
		resolveMessage,
		currentRuntimeSteps: [],
	}) as InitialValchecker<NonNullable<ExecutionSteps[number]['~def']>>
}
