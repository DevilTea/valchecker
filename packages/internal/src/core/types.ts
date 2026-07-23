import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { AnyFn, IsEqual, MaybePromise, MaybePromiseLike, OverloadParametersAndReturnType, UnionToIntersection, ValueOf } from '../shared'

export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> { }

export type IssueCategory = 'validation' | 'operation' | 'internal'

export interface IssueContext {
	type: string
	[key: string]: unknown
}

export interface ExecutionIssue<
	IssueCode extends string = (string & {}),
	IssuePayload = unknown,
	Category extends IssueCategory = 'validation',
> extends StandardSchemaV1.Issue {
	/** The code of the issue. */
	code: IssueCode
	/** The broad failure category used by combinators and consumers. */
	category: Category
	/** The payload of the issue. */
	payload: IssuePayload
	/** The error message of the issue. */
	message: string
	/** The data path of the issue. */
	path: PropertyKey[]
	/** Optional non-data provenance such as a union branch. */
	context?: IssueContext[] | undefined
}

export type AnyExecutionIssue = ExecutionIssue<string & {}, unknown, IssueCategory>

export interface ExecutionFailureResult<Issue extends AnyExecutionIssue> extends StandardSchemaV1.FailureResult {
	issues: [Issue, ...Issue[]]
}
export type ExecutionResult<Output = unknown, Issue extends AnyExecutionIssue = AnyExecutionIssue> = ExecutionSuccessResult<Output> | ExecutionFailureResult<Issue>

// T type
export interface TStepPluginDef {
	CurrentValchecker: unknown
}

export interface TStepMethodMeta {
	Name: string
	ExpectedCurrentValchecker: DefineExpectedValchecker<any>
	SelfIssue: AnyExecutionIssue
}

export type OperationMode = 'sync' | 'async' | 'maybe-async'

export interface TExecutionContext {
	initial: boolean
	/**
	 * Type-level execution mode read by `InferOperationMode`. This may be
	 * strictly MORE precise than the conservative runtime `~core.operationMode`;
	 * the two are NOT guaranteed to be equal. In particular `check`, `transform`,
	 * and `fallback` register `'maybe-async'` at runtime (a callback's async-ness
	 * is unobservable at registration), which takes the schema off the sync fast
	 * path even when the type level infers a narrower mode.
	 */
	operationMode: OperationMode
	input: unknown
	output: unknown
	issue: AnyExecutionIssue
}

export type TExecutionContextPatch = Partial<Omit<TExecutionContext, 'initial'>>

export interface TValchecker {
	'~core': {
		/**
		 * Type-level phantom with no runtime backing. Consulted only by
		 * `InferExecutionContext`; reading it at runtime yields `undefined`.
		 */
		executionStepContext: TExecutionContext
		/**
		 * Type-level phantom with no runtime backing. Consulted only by
		 * `InferRegisteredStepPluginDefs`; reading it at runtime yields
		 * `undefined`.
		 */
		registeredExecutionStepPlugins: TStepPluginDef
		/** Conservative runtime execution mode used for executor specialization. */
		readonly operationMode: OperationMode
	}
}

// Infering
export type InferExecutionContext<V extends TValchecker> = V['~core']['executionStepContext']
export type InferOperationMode<V extends TValchecker> = InferExecutionContext<V>['operationMode']
export type InferInput<V extends TValchecker> = InferExecutionContext<V>['input']
export type InferOutput<V extends TValchecker> = InferExecutionContext<V>['output']
export type InferIssue<V extends TValchecker> = InferExecutionContext<V>['issue']
export type InferRegisteredStepPluginDefs<V extends TValchecker> = V['~core']['registeredExecutionStepPlugins']
// `any` is passed as `This` deliberately: this resolution only reads the
// registered plugin defs, not the current instance, so a concrete `This` would
// only add instantiation cost without changing the result.
export type InferAllIssue<V extends TValchecker> = ResolveStepMethodDefs<V, any> extends infer Def
	? CoreIssue<RegisteredStepMethodName<InferRegisteredStepPluginDefs<V>>>
	| ValueOf<{
		[M in RegisteredStepMethodName<InferRegisteredStepPluginDefs<V>>]: M extends keyof Def
			? Def[M] extends { Type: 'ExecutionStep', Meta: TStepMethodMeta, Method: AnyFn }
				? Def[M]['Meta']['SelfIssue']
				: never
			: never
	}>
	: never

type PatchExecutionContext<Current extends TExecutionContext, Patch extends TExecutionContextPatch | undefined> = (
	IsEqual<Current, any> extends true
		? {
				initial: Patch extends { initial: infer I extends boolean } ? I : boolean
				operationMode: Patch extends { operationMode: infer A extends OperationMode } ? A : OperationMode
				input: Patch extends { input: infer I } ? I : unknown
				output: Patch extends { output: infer O } ? O : unknown
				issue: Patch extends { issue: infer I extends AnyExecutionIssue } ? I : AnyExecutionIssue
			}
		: {
				initial: false
				operationMode: Patch extends { operationMode: infer A extends OperationMode }
					? (Current['operationMode'] | A) extends infer M extends OperationMode
							? 'async' extends M
								? 'async'
								: 'maybe-async' extends M
									? 'maybe-async'
									: 'sync'
							: never
					: Current['operationMode']
				input: Patch extends { input: infer I }
					? I
					: Current['input']
				output: Patch extends { output: infer O }
					? O
					: Current['output']
				issue: Patch extends { issue: infer I extends AnyExecutionIssue }
					? (Current['issue'] | I)
					: Current['issue']
			}
) extends infer Patched extends TExecutionContext
	? Patched
	: never

type IsStepMethodDef<M> = [IsEqual<M, any>, IsEqual<M, unknown>, IsEqual<M, never>] extends [false, false, false]
	// If one of the checks is true, then true
	? [
			M extends { Type: 'ExecutionStep', Meta: TStepMethodMeta, Method: AnyFn }
				? IsEqual<M['Method'], never> extends true ? false : true
				: false,
		] extends [false]
			? false
			: true
	: false

type ResolveStepMethodDefs<Instance extends TValchecker, This = Instance> = UnionToIntersection<InferRegisteredStepPluginDefs<Instance>> & { CurrentValchecker: This }

type ExtractStepMethods<Instance extends Valchecker> = ResolveStepMethodDefs<Instance> extends infer Def
	? {
			[M in keyof Def as IsStepMethodDef<Def[M]> extends true ? M : never]: UnionToIntersection<Def[M] extends { Method: AnyFn } ? Def[M]['Method'] : never>
		}
	: never

interface OnlyInitialValcheckerMethods {
	isSuccess: (result: ExecutionResult) => result is ExecutionSuccessResult<any>
	isFailure: (result: ExecutionResult) => result is ExecutionFailureResult<any>
}

interface OnlyNotInitialValcheckerMethods<Instance extends Valchecker> {
	execute: (value: InferInput<Instance>) => [
		ExecutionResult<InferOutput<Instance>, InferIssue<Instance>>,
		InferOperationMode<Instance>,
	] extends [infer Result, infer OpMode]
		? IsEqual<OpMode, 'sync'> extends true
			? Result
			: IsEqual<OpMode, 'async'> extends true
				? Promise<Result>
				: MaybePromise<Result>
		: never
}

export type Use<Instance extends Valchecker> = Instance
	& ExtractStepMethods<Instance>
	& (
		InferExecutionContext<Instance>['initial'] extends false
			? OnlyNotInitialValcheckerMethods<Instance>
			: unknown
	)
	& (
		InferExecutionContext<Instance>['initial'] extends true
			? OnlyInitialValcheckerMethods
			: unknown
	)

export type Next<
	Patch extends TExecutionContextPatch | undefined,
	This extends TValchecker,
> = Use<Valchecker<
	PatchExecutionContext<InferExecutionContext<This>, Patch>,
	InferRegisteredStepPluginDefs<This>
>>

type RuntimeStep = (lastResult: ExecutionResult) => MaybePromise<ExecutionResult>

export interface Valchecker<
	CurrentExecutionContext extends TExecutionContext = TExecutionContext,
	RegisteredStepPlugins extends TStepPluginDef = TStepPluginDef,
> extends StandardSchemaV1<
		CurrentExecutionContext['input'],
		CurrentExecutionContext['output']
	> {
	readonly '~standard': {
		version: 1
		vendor: 'valchecker'
		validate: (value: unknown) => MaybePromise<ExecutionResult<CurrentExecutionContext['output'], CurrentExecutionContext['issue']>>
		types?: CurrentExecutionContext | undefined
	}

	readonly '~core': {
		executionStepContext: CurrentExecutionContext
		registeredExecutionStepPlugins: RegisteredStepPlugins
		readonly runtimeSteps: readonly RuntimeStep[]
		/** Conservative runtime execution mode used for executor specialization. */
		readonly operationMode: OperationMode
	}

	'~execute': (value: unknown) => MaybePromise<ExecutionResult<unknown, AnyExecutionIssue>>
}

// Impl
type IssueForCode<
	Issue extends AnyExecutionIssue,
	Code extends Issue['code'],
> = Extract<Issue, { code: Code }>

type DistributedMessageHandler<Issue extends AnyExecutionIssue> = Issue extends unknown
	? MessageHandler<Issue>
	: never

type CreateIssueContentForCode<Issue extends AnyExecutionIssue> = {
	code: Issue['code']
	payload: Issue['payload']
	path?: PropertyKey[] | undefined
	context?: Issue['context'] | undefined
	customMessage?: MessageHandler<Issue> | DistributedMessageHandler<Issue> | undefined
	defaultMessage?: MessageHandler<Issue> | DistributedMessageHandler<Issue> | undefined
} & (
	[Issue['category']] extends ['validation']
		? { category?: Issue['category'] | undefined }
		: { category: Issue['category'] }
)

type CreateIssueContent<Issue extends AnyExecutionIssue> = {
	[Code in Issue['code']]: CreateIssueContentForCode<IssueForCode<Issue, Code>>
}[Issue['code']]

// Impl
export interface StepMethodUtils<
	Input,
	Output,
	Issue extends AnyExecutionIssue,
	SelfIssue extends AnyExecutionIssue = Issue,
> {
	/** Registers a general step. Unspecified mode uses the plugin-level conservative default. */
	addStep: (
		fn: (lastResult: ExecutionResult<Input, Issue>) => MaybePromiseLike<ExecutionResult<Output, Issue>>,
		operationMode?: OperationMode,
	) => void
	/** Registers a success-only step. Unspecified mode uses the plugin-level conservative default. */
	addSuccessStep: (
		fn: (value: Input) => MaybePromiseLike<ExecutionResult<Output, Issue>>,
		operationMode?: OperationMode,
	) => void
	/** Registers a failure-only step. Unspecified mode uses the plugin-level conservative default. */
	addFailureStep: (
		fn: (issues: [AnyExecutionIssue, ...AnyExecutionIssue[]]) => MaybePromiseLike<ExecutionResult<Output, Issue>>,
		operationMode?: OperationMode,
	) => void

	isSuccess: (result: ExecutionResult) => result is ExecutionSuccessResult<any>
	isFailure: (result: ExecutionResult) => result is ExecutionFailureResult<any>

	prependIssuePath: <I extends AnyExecutionIssue>(
		issue: I,
		path: AnyExecutionIssue['path'],
		messageScope?: MessageHandler<any> | undefined,
	) => I
	appendIssueContext: <I extends AnyExecutionIssue>(
		issue: I,
		context: IssueContext,
	) => I

	success: (value: Output) => ExecutionSuccessResult<Output>
	failure: (issue: AnyExecutionIssue | AnyExecutionIssue[]) => ExecutionFailureResult<Issue>
	createIssue: <Content extends CreateIssueContent<SelfIssue>>(
		content: Content,
	) => IssueForCode<SelfIssue, Content['code']>
	issue: (i: Issue) => Issue
}

type ResolveExpectedThis<Def extends TStepPluginDef> = UnionToIntersection<Def> extends infer D extends TStepPluginDef
	? ValueOf<{ [M in keyof D as IsStepMethodDef<D[M]> extends true ? M : never]: D[M] extends { Type: 'ExecutionStep', Meta: infer Meta extends TStepMethodMeta }
		? Meta['ExpectedCurrentValchecker']
		: never
	}>
	: never

export type StepPluginImpl<StepPluginDef extends TStepPluginDef> = (UnionToIntersection<StepPluginDef> & { CurrentValchecker: Valchecker<any, StepPluginDef> }) extends infer Def extends TStepPluginDef
	? {
		[M in keyof Def as IsStepMethodDef<Def[M]> extends true ? M : never]: Def[M] extends { Type: 'ExecutionStep', Meta: TStepMethodMeta, Method: AnyFn }
			? OverloadParametersAndReturnType<UnionToIntersection<Def[M]['Method']> extends infer Method extends AnyFn ? Method : never> extends infer MethodTuple extends [params: any[], ret: Use<Valchecker>]
				? (
						payload: {
							utils: StepMethodUtils<
								InferOutput<Def[M]['Meta']['ExpectedCurrentValchecker']>,
								// If return type is Next<{ output: ... }>
								MethodTuple[1] extends Next<{ output: infer O }, any>
									// Extract the new output type
									? O
									// Fallback to current output type
									: InferOutput<ResolveExpectedThis<StepPluginDef>>,
								InferIssue<MethodTuple[1]>,
								Def[M]['Meta']['SelfIssue']
							>
							params: MethodTuple[0]
							context: {
								createInitialSchema: (method: string, params?: readonly unknown[]) => Use<Valchecker>
							}
						},
					) => void
				: never
			: never
	} & {
		readonly '~def'?: StepPluginDef
	}
	: never

export type DefineExpectedValchecker<ExpectedExecutionContext extends Partial<TExecutionContext> = TExecutionContext> = Valchecker<{
	initial: ExpectedExecutionContext extends { initial: infer I extends boolean } ? I : TExecutionContext['initial']
	operationMode: ExpectedExecutionContext extends { operationMode: infer O extends OperationMode } ? O : TExecutionContext['operationMode']
	input: ExpectedExecutionContext extends { input: infer I } ? I : TExecutionContext['input']
	output: ExpectedExecutionContext extends { output: infer O } ? O : TExecutionContext['output']
	issue: ExpectedExecutionContext extends { issue: infer C extends AnyExecutionIssue } ? C : TExecutionContext['issue']
}>

/**
 * Enforcement point for the `${Name}:${string}` issue-code prefix: the
 * `SelfIssue` constraint here is the ONLY place that requires a step's issue
 * codes to be prefixed with its method name. Defining a meta by writing a raw
 * `TStepMethodMeta` instead of going through `DefineStepMethodMeta` bypasses
 * this check entirely (a step quality test is the backstop).
 */
export interface DefineStepMethodMeta<Meta extends {
	Name: string
	ExpectedCurrentValchecker: DefineExpectedValchecker<any>
	SelfIssue?: ExecutionIssue<`${Meta['Name']}:${string}`, unknown, IssueCategory>
}> extends TStepMethodMeta {
	Name: Meta['Name']
	ExpectedCurrentValchecker: Meta['ExpectedCurrentValchecker']
	SelfIssue: Meta extends { SelfIssue: AnyExecutionIssue }
		? Meta['SelfIssue']
		: never
}

export interface DefineStepMethod<Meta extends TStepMethodMeta, Method extends AnyFn> { Type: 'ExecutionStep', Meta: Meta, Method: Method }

export type RegisteredStepMethodName<RegisteredStepPluginDefs extends TStepPluginDef> = Exclude<keyof UnionToIntersection<RegisteredStepPluginDefs>, 'CurrentValchecker'> extends infer N extends string ? N : never

export type UnknownExceptionIssue<M extends string = string> = ExecutionIssue<
	'core:unknown_exception',
	{ method: M, receivedResult: ExecutionResult, error: unknown },
	'internal'
>

export type MessageExceptionIssue = ExecutionIssue<
	'core:message_exception',
	{
		source: 'step' | 'context' | 'global' | 'default'
		unresolvedIssue: {
			code: string
			category: IssueCategory
			payload: unknown
			path: PropertyKey[]
			context?: IssueContext[] | undefined
		}
		error: unknown
	},
	'internal'
>

export type CoreIssue<M extends string = string> = UnknownExceptionIssue<M> | MessageExceptionIssue

export type InitialValchecker<RegisteredStepPluginDefs extends TStepPluginDef> = Use<Valchecker<{
	initial: true
	operationMode: 'sync'
	input: unknown
	output: unknown
	issue: CoreIssue<RegisteredStepMethodName<RegisteredStepPluginDefs>>
}, RegisteredStepPluginDefs>>

type IssueMessageInput<Issue extends AnyExecutionIssue> = Issue extends unknown
	? {
			code: Issue['code']
			category: Issue['category']
			payload: Issue['payload']
			path: Issue['path']
			context: Issue['context']
		}
	: never

type MessageMap<Issue extends AnyExecutionIssue> = {
	[Code in Issue['code']]?: (
		issue: IssueMessageInput<IssueForCode<Issue, Code>>,
	) => string | undefined | null
}

/**
 * Custom message: a static string, a function receiving the typed issue, or a
 * map keyed by issue code.
 *
 * Map-form handler params are contextually typed only against a concrete issue
 * union. When the union flows through an unresolved generic (e.g.
 * `createValchecker`'s inference or structural step options), map-form params
 * fall back to implicit `any`; annotate the param explicitly or use the
 * function form, which stays typed through generics.
 */
export type MessageHandler<Issue extends AnyExecutionIssue = AnyExecutionIssue>
	= | string
		| ((issue: IssueMessageInput<Issue>) => string | undefined | null)
		| MessageMap<Issue>

/**
 * Optional configuration shared by message-bearing built-in steps.
 *
 * Built-in APIs may keep one required semantic operand positional. Every
 * optional configuration field, including the custom issue message, belongs
 * in one trailing options object.
 */
export interface StepOptions<Issue extends AnyExecutionIssue = AnyExecutionIssue> {
	readonly message?: MessageHandler<Issue> | undefined
}

/** Optional configuration for structural steps that evaluate multiple children. */
export interface StructuralStepOptions<Issue extends AnyExecutionIssue = AnyExecutionIssue> extends StepOptions<Issue> {
	/** Continue after recoverable child failures and collect issues from later children. Defaults to `false`. */
	readonly collectAllIssues?: boolean | undefined
}

export type ResolveMessageFn = (param: {
	data: IssueMessageInput<AnyExecutionIssue>
	customMessage?: MessageHandler<any> | undefined
	contextMessages?: MessageHandler<any>[] | undefined
	defaultMessage?: MessageHandler<any> | undefined
}) => string
