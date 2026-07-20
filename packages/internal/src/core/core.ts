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

interface StepMethodContext {
	createInitialSchema: (method: string, params?: readonly unknown[]) => any
}

type MessageData = {
	code: string
	category?: IssueCategory | undefined
	payload: unknown
	path: PropertyKey[]
	context?: IssueContext[] | undefined
}

type MessageSource = 'step' | 'context' | 'global' | 'default'
type RuntimeResolveMessageFn = ResolveMessageFn & {
	globalMessage?: MessageHandler<any> | undefined
}

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

const issueDraftMetadata = Symbol('valchecker.issueDraftMetadata')

type IssueWithDraftMetadata = AnyExecutionIssue & {
	[issueDraftMetadata]?: IssueDraftMetadata | undefined
}

function getIssueDraftMetadata(issue: AnyExecutionIssue): IssueDraftMetadata | undefined {
	return (issue as IssueWithDraftMetadata)[issueDraftMetadata]
}

function setIssueDraftMetadata(
	issue: AnyExecutionIssue,
	metadata: IssueDraftMetadata,
): void {
	Object.defineProperty(issue, issueDraftMetadata, { value: metadata })
}

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
	const metadata = getIssueDraftMetadata(issue)
	const hasMessageScope = messageScope != null

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
		setIssueDraftMetadata(nextIssue, {
			...metadata,
			contextMessages: hasMessageScope
				? [...metadata.contextMessages, messageScope]
				: metadata.contextMessages,
		})
	}
	else if (hasMessageScope) {
		setIssueDraftMetadata(nextIssue, {
			resolveMessage: resolveExternalIssueMessage,
			contextMessages: [messageScope],
			defaultMessage: issue.message,
		})
	}

	return nextIssue
}


/* @__NO_SIDE_EFFECTS__ */
export function appendIssueContext<Issue extends AnyExecutionIssue>(
	issue: Issue,
	context: IssueContext,
): Issue {
	const metadata = getIssueDraftMetadata(issue)
	const nextIssue = {
		...issue,
		context: issue.context == null
			? [context]
			: [...issue.context, context],
	}
	if (metadata != null)
		setIssueDraftMetadata(nextIssue, metadata)
	return nextIssue as Issue
}

/* @__NO_SIDE_EFFECTS__ */
export function hasInternalIssue(issues: readonly AnyExecutionIssue[]): boolean {
	for (let i = 0; i < issues.length; i++) {
		if (issues[i]!.category === 'internal')
			return true
	}
	return false
}

/* @__NO_SIDE_EFFECTS__ */
export function isRecoverableFailure(
	result: ExecutionResult,
): result is ExecutionFailureResult<AnyExecutionIssue> {
	return isFailure(result) && !hasInternalIssue(result.issues)
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
): RuntimeResolveMessageFn {
	const resolveMessage: RuntimeResolveMessageFn = ({
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
	resolveMessage.globalMessage = globalMessage
	return resolveMessage
}

const resolveExternalIssueMessage = createResolveMessageFunction()

function hasDynamicMessageForCode(
	message: MessageHandler<any> | undefined | null,
	code: string,
): boolean {
	if (typeof message === 'function')
		return true
	return message != null
		&& typeof message === 'object'
		&& Object.hasOwn(message, code)
		&& typeof (message as any)[code] === 'function'
}

function resolveStaticIssueMessage(
	code: string,
	customMessage: MessageHandler<any> | undefined | null,
	globalMessage: MessageHandler<any> | undefined,
	defaultMessage: MessageHandler<any> | undefined | null,
): string | undefined {
	if (typeof customMessage === 'string' || hasDynamicMessageForCode(customMessage, code))
		return undefined
	if (typeof globalMessage === 'string')
		return globalMessage
	if (hasDynamicMessageForCode(globalMessage, code))
		return undefined
	if (typeof defaultMessage === 'string')
		return defaultMessage
	if (hasDynamicMessageForCode(defaultMessage, code))
		return undefined
	return 'Invalid value.'
}

function getInitialIssueMessage(
	customMessage: MessageHandler<any> | undefined | null,
	globalMessage: MessageHandler<any> | undefined,
	defaultMessage: MessageHandler<any> | undefined | null,
): string {
	if (typeof customMessage === 'string')
		return customMessage
	if (typeof globalMessage === 'string')
		return globalMessage
	if (typeof defaultMessage === 'string')
		return defaultMessage
	return 'Invalid value.'
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

function createUnresolvedIssueSnapshot(
	issue: AnyExecutionIssue,
): MessageExceptionIssue['payload']['unresolvedIssue'] {
	const snapshot: MessageExceptionIssue['payload']['unresolvedIssue'] = {
		code: issue.code,
		category: issue.category,
		payload: issue.payload,
		path: [...issue.path],
	}
	if (issue.context != null)
		snapshot.context = [...issue.context]
	return snapshot
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
			unresolvedIssue: createUnresolvedIssueSnapshot(unresolvedIssue),
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

function finalizeIssue(
	issue: AnyExecutionIssue,
	metadata: IssueDraftMetadata,
): AnyExecutionIssue {
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
		return createMessageExceptionIssue(
			issue,
			error as MessageResolutionError,
			metadata.resolveMessage,
		)
	}
}

function finalizeFailureResult(
	result: ExecutionFailureResult<AnyExecutionIssue>,
): ExecutionFailureResult<AnyExecutionIssue> {
	const issues = result.issues
	const firstIssue = issues[0]!
	const firstMetadata = getIssueDraftMetadata(firstIssue)
	if (issues.length === 1) {
		return firstMetadata == null
			? result
			: { issues: [finalizeIssue(firstIssue, firstMetadata)] }
	}

	let finalizedIssues: AnyExecutionIssue[] | undefined
	for (let i = 0; i < issues.length; i++) {
		const issue = issues[i]!
		const metadata = i === 0 ? firstMetadata : getIssueDraftMetadata(issue)
		if (metadata != null) {
			finalizedIssues ??= issues.slice(0, i)
			finalizedIssues.push(finalizeIssue(issue, metadata))
		}
		else if (finalizedIssues != null) {
			finalizedIssues.push(issue)
		}
	}

	return finalizedIssues == null
		? result
		: { issues: finalizedIssues as [AnyExecutionIssue, ...AnyExecutionIssue[]] }
}

function hasIssueDraft(issues: readonly AnyExecutionIssue[]): boolean {
	for (let i = 0; i < issues.length; i++) {
		if ((issues[i] as IssueWithDraftMetadata)[issueDraftMetadata] != null)
			return true
	}
	return false
}

function finalizeAsyncResult(result: ExecutionResult): ExecutionResult {
	return 'issues' in result && hasIssueDraft(result.issues)
		? finalizeFailureResult(result)
		: result
}

function createPublicExecutor(executeRaw: PipeExecutor): PipeExecutor {
	return (value) => {
		const result = executeRaw(value)
		if (isPromiseLike(result))
			return Promise.resolve(result).then(finalizeAsyncResult)
		return 'issues' in result && hasIssueDraft(result.issues)
			? finalizeFailureResult(result)
			: result
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createUnknownExceptionFailure(
	method: string,
	lastResult: ExecutionResult,
	error: unknown,
	resolveMessage: ResolveMessageFn,
): ExecutionFailureResult<CoreIssue> {
	const code = 'core:unknown_exception'
	const defaultMessage = 'An unexpected error occurred during step execution'
	const globalMessage = (resolveMessage as RuntimeResolveMessageFn).globalMessage
	const staticMessage = resolveStaticIssueMessage(code, undefined, globalMessage, defaultMessage)
	const issue: ExecutionIssue<
		typeof code,
		{ method: string, receivedResult: ExecutionResult, error: unknown },
		'internal'
	> = {
		code,
		category: 'internal',
		payload: { method, receivedResult: lastResult, error },
		message: staticMessage ?? getInitialIssueMessage(undefined, globalMessage, defaultMessage),
		path: [],
	}
	if (staticMessage == null) {
		setIssueDraftMetadata(issue, {
			resolveMessage,
			contextMessages: [],
			defaultMessage,
		})
	}
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
		appendIssueContext,
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
			const globalMessage = (resolveMessage as RuntimeResolveMessageFn).globalMessage
			const staticMessage = resolveStaticIssueMessage(
				code,
				customMessage,
				globalMessage,
				defaultMessage,
			)
			const issue: AnyExecutionIssue = {
				code,
				category,
				payload,
				path,
				message: staticMessage ?? getInitialIssueMessage(
					customMessage,
					globalMessage,
					defaultMessage,
				),
			}
			if (context != null)
				issue.context = context
			if (staticMessage == null) {
				setIssueDraftMetadata(issue, {
					resolveMessage,
					customMessage,
					contextMessages: [],
					defaultMessage,
				})
			}
			return issue
		},
		issue: i => i,
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createStepMethodContext({
	stepMethods,
	resolveMessage,
}: {
	stepMethods: Record<PropertyKey, unknown>
	resolveMessage: ResolveMessageFn
}): StepMethodContext {
	const context: StepMethodContext = {
		createInitialSchema: (method, params = []) => {
			const stepMethod = stepMethods[method]
			if (typeof stepMethod !== 'function')
				throw new TypeError(`Required step method is not registered: ${method}`)

			const runtimeSteps: RuntimeStep[] = []
			stepMethod({
				utils: createExecutionStepMethodUtils(
					method,
					runtimeSteps,
					resolveMessage,
				),
				params: [...params],
				context,
			})
			return createInstance({
				stepMethods,
				resolveMessage,
				context,
				currentRuntimeSteps: runtimeSteps,
			})
		},
	}
	return context
}

/* @__NO_SIDE_EFFECTS__ */
function createProxyHandler({
	stepMethods,
	resolveMessage,
	runtimeSteps,
	context,
}: {
	stepMethods: Record<PropertyKey, unknown>
	resolveMessage: ResolveMessageFn
	runtimeSteps: RuntimeStep[]
	context: StepMethodContext
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
					context,
				})
				return createInstance({
					stepMethods,
					resolveMessage,
					context,
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
	context,
	currentRuntimeSteps,
}: {
	stepMethods: Record<PropertyKey, unknown>
	resolveMessage: ResolveMessageFn
	context: StepMethodContext
	currentRuntimeSteps: RuntimeStep[]
}): any {
	Object.freeze(currentRuntimeSteps)
	const executeRaw = createFinalizedPipeExecutor(currentRuntimeSteps)
	const coreProperties = createCoreProperties(currentRuntimeSteps, executeRaw)

	return new Proxy(coreProperties, createProxyHandler({ stepMethods, resolveMessage, runtimeSteps: currentRuntimeSteps, context }))
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
	const context = createStepMethodContext({ stepMethods, resolveMessage })

	return createInstance({
		stepMethods,
		resolveMessage,
		context,
		currentRuntimeSteps: [],
	}) as InitialValchecker<NonNullable<ExecutionSteps[number]['~def']>>
}
