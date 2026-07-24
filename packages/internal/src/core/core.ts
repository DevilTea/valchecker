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
	OperationMode,
	ResolveMessageFn,
	StepMethodUtils,
	StepPluginImpl,
	TStepPluginDef,
} from './types'
import { isPromiseLike, runtimeExecutionStepDefMarker } from '../shared'

type RuntimeStep = (lastResult: ExecutionResult) => MaybePromise<ExecutionResult>
type PipeExecutor = (value: unknown) => MaybePromise<ExecutionResult>

const stepPluginDefaultOperationMode = Symbol.for('valchecker.stepPluginDefaultOperationMode')

const RUNTIME_OPERATION_MODE_SYNC = 0
const RUNTIME_OPERATION_MODE_MAYBE_ASYNC = 1
const RUNTIME_OPERATION_MODE_ASYNC = 2
const OPERATION_MODES = ['sync', 'maybe-async', 'async'] as const

type RuntimeOperationMode
	= | typeof RUNTIME_OPERATION_MODE_SYNC
		| typeof RUNTIME_OPERATION_MODE_MAYBE_ASYNC
		| typeof RUNTIME_OPERATION_MODE_ASYNC

type RuntimeStepMethodUtils = StepMethodUtils<any, any, any, any> & {
	'~operationMode': RuntimeOperationMode
	'~metadata': Record<symbol, unknown> | undefined
}

interface RegisteredStepMethod {
	run: AnyFn
	defaultOperationMode: RuntimeOperationMode
}

type RegisteredStepMethods = Record<PropertyKey, RegisteredStepMethod>

function toRuntimeOperationMode(operationMode: OperationMode): RuntimeOperationMode {
	return operationMode === 'sync'
		? RUNTIME_OPERATION_MODE_SYNC
		: operationMode === 'async'
			? RUNTIME_OPERATION_MODE_ASYNC
			: RUNTIME_OPERATION_MODE_MAYBE_ASYNC
}

interface StepMethodContext {
	createInitialSchema: (method: string, params?: readonly unknown[]) => any
}

interface MessageData {
	code: string
	category?: IssueCategory | undefined
	payload: unknown
	path: PropertyKey[]
	context?: IssueContext[] | undefined
}

type MessageSource = 'step' | 'context' | 'global' | 'default'

/**
 * Pairs the runtime message resolver with the global handler it closes over.
 * The global handler is carried as its own field rather than hung off the
 * resolver function so a resolver can never silently omit it.
 */
interface RuntimeMessageResolver {
	resolve: ResolveMessageFn
	globalMessage: MessageHandler<any> | undefined
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
export function implStepPlugin<StepPluginDef extends TStepPluginDef>(
	stepImpl: StepPluginImpl<StepPluginDef>,
	defaultOperationMode: OperationMode = 'maybe-async',
): StepPluginImpl<StepPluginDef> {
	(stepImpl as any)[runtimeExecutionStepDefMarker] = true
	Object.defineProperty(stepImpl, stepPluginDefaultOperationMode, {
		value: toRuntimeOperationMode(defaultOperationMode),
	})
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

const resolveExternalIssueMessage = createMessageResolver()

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
			resolveMessage: resolveExternalIssueMessage.resolve,
			contextMessages: [messageScope],
			defaultMessage: issue.message,
		})
	}

	return nextIssue
}

/**
 * Rebuilds an issue with `path` REPLACING its existing path unconditionally,
 * preserving message-scope and draft-metadata handling. Unlike
 * `prependIssuePath` (which merges the new path in front of the existing one),
 * this overwrites the path outright — needed by steps that remap child paths,
 * such as `tuple`'s rest region.
 *
 * Package-internal: not re-exported from `core/index.ts` (parity with
 * `prependIssuePath`); steps reach it through `utils`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function replaceIssuePath<Issue extends AnyExecutionIssue>(
	issue: Issue,
	path: Issue['path'],
	messageScope?: MessageHandler<any> | undefined,
): Issue {
	const metadata = getIssueDraftMetadata(issue)
	const hasMessageScope = messageScope != null

	const nextIssue = {
		...issue,
		path: [...path],
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
			resolveMessage: resolveExternalIssueMessage.resolve,
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

/**
 * Runs a runtime step array over a seed result, switching to promise chaining
 * as soon as any step turns asynchronous.
 *
 * Package-internal (intentionally not re-exported from `core/index.ts`): the
 * `generic` step imports it directly from `core/core` so lazily-resolved
 * sub-schema pipelines run through the same loop instead of a hand-rolled copy.
 */
/* @__NO_SIDE_EFFECTS__ */
export function executeRuntimeSteps(
	runtimeSteps: readonly RuntimeStep[],
	initialResult: ExecutionResult,
): MaybePromise<ExecutionResult> {
	const len = runtimeSteps.length
	let result: MaybePromise<ExecutionResult> = initialResult

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

function createFinalizedPipeExecutor(
	runtimeSteps: RuntimeStep[],
	operationMode: RuntimeOperationMode,
): PipeExecutor {
	const len = runtimeSteps.length
	if (len === 0)
		return value => ({ value })

	const first = runtimeSteps[0]!
	if (operationMode === RUNTIME_OPERATION_MODE_SYNC) {
		if (len === 1)
			return value => first({ value }) as ExecutionResult

		const second = runtimeSteps[1]!
		if (len === 2) {
			return value => second(first({ value }) as ExecutionResult) as ExecutionResult
		}

		return (value) => {
			let result = first({ value }) as ExecutionResult
			for (let i = 1; i < len; i++)
				result = runtimeSteps[i]!(result) as ExecutionResult
			return result
		}
	}

	if (len === 1)
		return value => first({ value })

	if (len === 2) {
		const second = runtimeSteps[1]!
		return (value) => {
			const result = first({ value })
			return isPromiseLike(result)
				? Promise.resolve(result)
						.then(second)
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

/**
 * Runtime message resolution (the DYNAMIC path): resolves the final message by
 * walking the precedence tiers custom -> context -> global -> default ->
 * 'Invalid value.'.
 *
 * This tier order is duplicated across three functions that must stay in
 * lockstep: `resolveMessagePriority` (this one, dynamic resolution at
 * finalization), `resolveStaticIssueMessage` (the STATIC fast path that decides
 * whether a message is determinable up front), and `getInitialIssueMessage`
 * (placeholder chooser while deferral is pending). `hasDynamicMessageForCode`
 * defines what counts as "dynamic" for the static path. Any change to the tier
 * order, the fallback string, or what makes a handler dynamic must be applied to
 * all of them, or a static/dynamic disagreement silently picks the wrong tier.
 * `message-contracts.test.ts` asserts the static and dynamic paths agree.
 */
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
function createMessageResolver(
	globalMessage?: MessageHandler<any> | undefined,
): RuntimeMessageResolver {
	return {
		resolve: ({
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
		}),
		globalMessage,
	}
}

/**
 * Defines what counts as a "dynamic" (deferred) message handler for the static
 * fast path: a bare function, or a message map with an own function entry for
 * the issue code. Must agree with how `resolveMessagePriority` treats handlers.
 * See the lockstep note on `resolveMessagePriority`.
 */
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

/**
 * Static fast path: returns the final message when it is determinable without
 * deferral, or `undefined` to signal that dynamic resolution via
 * `resolveMessagePriority` is required. Encodes the same tier order (custom ->
 * global -> default -> 'Invalid value.'); context handlers are always dynamic
 * and force deferral, so they are not considered here. Must stay in lockstep
 * with `resolveMessagePriority` and `getInitialIssueMessage`.
 */
export function resolveStaticIssueMessage(
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

/**
 * Placeholder chooser used while dynamic resolution is deferred: picks the
 * first string handler along the same tier order. Must stay in lockstep with
 * `resolveMessagePriority` and `resolveStaticIssueMessage`.
 */
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
			error instanceof MessageResolutionError
				? error
				: new MessageResolutionError('default', error),
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
	return isFailure(result) && hasIssueDraft(result.issues)
		? finalizeFailureResult(result)
		: result
}

function createPublicExecutor(
	executeRaw: PipeExecutor,
	operationMode: RuntimeOperationMode,
): PipeExecutor {
	if (operationMode === RUNTIME_OPERATION_MODE_SYNC) {
		return (value) => {
			const result = executeRaw(value) as ExecutionResult
			return isFailure(result) && hasIssueDraft(result.issues)
				? finalizeFailureResult(result)
				: result
		}
	}

	if (operationMode === RUNTIME_OPERATION_MODE_ASYNC) {
		return value => Promise.resolve(executeRaw(value))
			.then(finalizeAsyncResult)
	}

	return (value) => {
		const result = executeRaw(value)
		if (isPromiseLike(result)) {
			return Promise.resolve(result)
				.then(finalizeAsyncResult)
		}
		return isFailure(result) && hasIssueDraft(result.issues)
			? finalizeFailureResult(result)
			: result
	}
}

/* @__NO_SIDE_EFFECTS__ */
function createUnknownExceptionFailure(
	method: string,
	lastResult: ExecutionResult,
	error: unknown,
	resolver: RuntimeMessageResolver,
): ExecutionFailureResult<CoreIssue> {
	const code = 'core:unknown_exception'
	const defaultMessage = 'An unexpected error occurred during step execution'
	const globalMessage = resolver.globalMessage
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
			resolveMessage: resolver.resolve,
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
	resolver: RuntimeMessageResolver,
	currentOperationMode: RuntimeOperationMode,
	defaultOperationMode: RuntimeOperationMode,
): RuntimeStepMethodUtils {
	const wrapWithErrorHandling = (
		fn: (lastResult: ExecutionResult) => MaybePromiseLike<ExecutionResult>,
		operationMode: RuntimeOperationMode,
	): RuntimeStep => {
		if (operationMode === RUNTIME_OPERATION_MODE_SYNC) {
			return (lastResult) => {
				try {
					return fn(lastResult) as ExecutionResult
				}
				catch (error) {
					return createUnknownExceptionFailure(method, lastResult, error, resolver)
				}
			}
		}

		if (operationMode === RUNTIME_OPERATION_MODE_ASYNC) {
			return (lastResult) => {
				try {
					return Promise.resolve(fn(lastResult))
						.catch(
							error => createUnknownExceptionFailure(method, lastResult, error, resolver),
						)
				}
				catch (error) {
					return Promise.resolve(createUnknownExceptionFailure(method, lastResult, error, resolver))
				}
			}
		}

		return (lastResult) => {
			try {
				const result = fn(lastResult)
				return isPromiseLike(result)
					? Promise.resolve(result)
							.catch(error => createUnknownExceptionFailure(method, lastResult, error, resolver))
					: result
			}
			catch (error) {
				return createUnknownExceptionFailure(method, lastResult, error, resolver)
			}
		}
	}

	const utils: RuntimeStepMethodUtils = {
		'~operationMode': currentOperationMode,
		'~metadata': undefined,
		'setMetadata': (key, value) => {
			(utils['~metadata'] ??= {})[key] = value
		},
		'addStep': (fn, operationMode) => {
			const runtimeOperationMode = operationMode == null
				? defaultOperationMode
				: toRuntimeOperationMode(operationMode)
			runtimeExecutions.push(wrapWithErrorHandling(fn, runtimeOperationMode))
			if (runtimeOperationMode > utils['~operationMode'])
				utils['~operationMode'] = runtimeOperationMode
		},
		'addSuccessStep': (fn, operationMode) => {
			const runtimeOperationMode = operationMode == null
				? defaultOperationMode
				: toRuntimeOperationMode(operationMode)
			runtimeExecutions.push(wrapWithErrorHandling(result => 'value' in result ? fn(result.value) : result, runtimeOperationMode))
			if (runtimeOperationMode > utils['~operationMode'])
				utils['~operationMode'] = runtimeOperationMode
		},
		'addFailureStep': (fn, operationMode) => {
			const runtimeOperationMode = operationMode == null
				? defaultOperationMode
				: toRuntimeOperationMode(operationMode)
			runtimeExecutions.push(wrapWithErrorHandling(result => isFailure(result) ? fn(result.issues) : result, runtimeOperationMode))
			if (runtimeOperationMode > utils['~operationMode'])
				utils['~operationMode'] = runtimeOperationMode
		},
		isSuccess,
		isFailure,
		prependIssuePath,
		replaceIssuePath,
		appendIssueContext,
		'success': value => ({ value }),
		'failure': (issueOrIssues) => {
			const issues = Array.isArray(issueOrIssues) ? issueOrIssues : [issueOrIssues]
			if (issues.length === 0)
				throw new TypeError('A failure result requires at least one issue.')
			return { issues: issues as [AnyExecutionIssue, ...AnyExecutionIssue[]] }
		},
		'createIssue': ({
			code,
			category = 'validation',
			payload,
			path = [],
			context,
			customMessage,
			defaultMessage,
		}: any) => {
			const globalMessage = resolver.globalMessage
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
					resolveMessage: resolver.resolve,
					customMessage,
					contextMessages: [],
					defaultMessage,
				})
			}
			return issue
		},
		'issue': i => i,
	}
	return utils
}

// Fixed properties installed as own, enumerable properties on every schema
// instance. MUST stay in sync with the own properties `buildInstance` assigns
// below; a step method whose name collides with one of these is rejected at
// registration. `then` is reserved in addition so an instance is never mistaken
// for a thenable. Construction-time cost only (computed once at module load).
const coreInstancePropertyKeys = ['~standard', '~core', '~execute', 'execute', 'isSuccess', 'isFailure'] as const
const reservedStepMethodNames = new Set<PropertyKey>([...coreInstancePropertyKeys, 'then'])

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
				operationMode: any
			}
		}>
	>
}) {
	const stepMethods = Object.create(null) as RegisteredStepMethods
	for (const def of steps) {
		const defaultOperationMode = (def as any)[stepPluginDefaultOperationMode] ?? RUNTIME_OPERATION_MODE_MAYBE_ASYNC
		for (const method of Reflect.ownKeys(def)) {
			if (method === runtimeExecutionStepDefMarker || method === stepPluginDefaultOperationMode)
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
			// The `typeof === 'function'` guard proves callability at runtime, but TS's
			// `Function` type carries no call signature, so it is not assignable to `AnyFn`.
			stepMethods[method] = { run: stepMethod as AnyFn, defaultOperationMode }
		}
	}
	const resolver = createMessageResolver(globalMessage as MessageHandler<any> | undefined)

	// Every schema instance shares this prototype. Step methods live here as
	// non-enumerable properties so they resolve through the ordinary prototype
	// chain. This replaces a per-instance `Proxy` whose `get` trap ran on every
	// property read — including the hot `execute`, `~execute`, and `~core`
	// paths that structural steps read per child schema — adding ~30ns of fixed
	// overhead per access with nothing else to gain (the trap only resolved
	// step methods). Measured primitive `execute` 39.6ns -> 11.5ns and raw
	// `~execute` read 39ns -> 6.8ns (2026-07-23).
	const prototype: any = {}

	const buildInstance = (
		runtimeSteps: RuntimeStep[],
		operationMode: RuntimeOperationMode,
		metadata: Record<symbol, unknown> | undefined,
	): any => {
		const executeRaw = createFinalizedPipeExecutor(runtimeSteps, operationMode)
		const execute = createPublicExecutor(executeRaw, operationMode)
		const instance: any = Object.create(prototype)
		instance['~standard'] = { version: 1, vendor: 'valchecker', validate: execute }
		// `metadata` is assigned unconditionally (even when `undefined`) so every
		// `~core` object keeps the same shape and V8's hidden class stays monomorphic.
		instance['~core'] = { runtimeSteps, operationMode: OPERATION_MODES[operationMode], metadata }
		instance['~execute'] = executeRaw
		instance.execute = execute
		instance.isSuccess = isSuccess
		instance.isFailure = isFailure
		return instance
	}

	const context: StepMethodContext = {
		createInitialSchema: (method, params = []) => {
			const registeredStepMethod = stepMethods[method]
			if (registeredStepMethod == null)
				throw new TypeError(`Required step method is not registered: ${method}`)

			const runtimeSteps: RuntimeStep[] = []
			const utils = createExecutionStepMethodUtils(
				method,
				runtimeSteps,
				resolver,
				RUNTIME_OPERATION_MODE_SYNC,
				registeredStepMethod.defaultOperationMode,
			)
			registeredStepMethod.run({
				utils,
				params: [...params],
				context,
			})
			return buildInstance(runtimeSteps, utils['~operationMode'], utils['~metadata'])
		},
	}

	for (const method of Object.keys(stepMethods)) {
		const registeredStepMethod = stepMethods[method]!
		Object.defineProperty(prototype, method, {
			configurable: true,
			enumerable: false,
			writable: true,
			value(this: any, ...params: any[]) {
				const nextRuntimeSteps = [...(this['~core'].runtimeSteps as RuntimeStep[])]
				const utils = createExecutionStepMethodUtils(
					method,
					nextRuntimeSteps,
					resolver,
					toRuntimeOperationMode(this['~core'].operationMode),
					registeredStepMethod.defaultOperationMode,
				)
				registeredStepMethod.run({
					utils,
					params,
					context,
				})
				return buildInstance(nextRuntimeSteps, utils['~operationMode'], utils['~metadata'])
			},
		})
	}

	return buildInstance([], RUNTIME_OPERATION_MODE_SYNC, undefined) as InitialValchecker<NonNullable<ExecutionSteps[number]['~def']>>
}
