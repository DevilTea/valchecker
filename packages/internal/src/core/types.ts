import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { AnyFn, IsEqual, MaybePromise, OverloadParametersAndReturnType, UnionToIntersection, ValueOf } from '../shared'

export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> { }
export interface ExecutionIssue<
	IssueCode extends string = (string & {}),
	IssuePayload = unknown,
> extends StandardSchemaV1.Issue {
	/** The code of the issue. */
	code: IssueCode
	/** The payload of the issue. */
	payload: IssuePayload
	/** The error message of the issue. */
	message: string
	/** The path of the issue. */
	path: PropertyKey[]
}
export interface ExecutionFailureResult<Issue extends ExecutionIssue> extends StandardSchemaV1.FailureResult {
	issues: Issue[]
}
export type ExecutionResult<Output = unknown, Issue extends ExecutionIssue = ExecutionIssue> = ExecutionSuccessResult<Output> | ExecutionFailureResult<Issue>

// T type
export interface TStepPluginDef {
	CurrentValchecker: unknown
}

export interface TStepMethodMeta {
	Name: string
	ExpectedCurrentValchecker: DefineExpectedValchecker<any>
	SelfIssue: ExecutionIssue
}

export type OperationMode = 'sync' | 'async' | 'maybe-async'

export interface TExecutionContext {
	initial: boolean
	operationMode: OperationMode
	input: unknown
	output: unknown
	issue: ExecutionIssue
}

export type TExecutionContextPatch = Partial<Omit<TExecutionContext, 'initial'>>

export interface TValchecker {
	'~core': {
		executionStepContext: TExecutionContext
		registeredExecutionStepPlugins: TStepPluginDef
	}
}

// Infering
export type InferExecutionContext<V extends TValchecker> = V['~core']['executionStepContext']
export type InferOperationMode<V extends TValchecker> = InferExecutionContext<V>['operationMode']
export type InferInput<V extends TValchecker> = InferExecutionContext<V>['input']
export type InferOutput<V extends TValchecker> = InferExecutionContext<V>['output']
export type InferIssue<V extends TValchecker> = InferExecutionContext<V>['issue']
export type InferRegisteredStepPluginDefs<V extends TValchecker> = V['~core']['registeredExecutionStepPlugins']
export type InferAllIssue<V extends TValchecker> = ResolveStepMethodDefs<V, any> extends infer Def
	? UnknownExceptionIssue<RegisteredStepMethodName<InferRegisteredStepPluginDefs<V>>>
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
				issue: Patch extends { issue: infer I extends ExecutionIssue } ? I : ExecutionIssue
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
				issue: Patch extends { issue: infer I extends ExecutionIssue }
					? (Current['issue'] | I)
					: Current['issue']
			}
) extends infer Patched extends TExecutionContext
	? Patched
	: never

type IsStepMethodDef<M> = [IsEqual<M, any>, IsEqual<M, unknown>, IsEqual<M, never>] extends [false, false, false]
	// If one of the checks is true, then true
	?	IsEqual<
		M extends { Type: 'ExecutionStep', Meta: TStepMethodMeta, Method: AnyFn }
			?	IsEqual<M['Method'], never> extends true ? false : true
			:	false,
		false
	> extends true
		?	false
		:	true
	:	false

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
		validate: (value: unknown) => MaybePromise<ExecutionResult>
		types?: CurrentExecutionContext | undefined
	}

	readonly '~core': {
		executionStepContext: CurrentExecutionContext
		registeredExecutionStepPlugins: RegisteredStepPlugins
		runtimeSteps: RuntimeStep[]
	}

	'~execute': (value: unknown) => MaybePromise<ExecutionResult<unknown, ExecutionIssue>>
}

// Impl
export interface StepMethodUtils<
	Input,
	Output,
	Issue extends ExecutionIssue,
> {
	addStep: (fn: (lastResult: ExecutionResult<Input, Issue>) => MaybePromise<ExecutionResult<Output, Issue>>) => void
	addSuccessStep: (fn: (value: Input) => MaybePromise<ExecutionResult<Output, Issue>>) => void
	addFailureStep: (fn: (issues: ExecutionIssue[]) => MaybePromise<ExecutionResult<Output, Issue>>) => void

	isSuccess: (result: ExecutionResult) => result is ExecutionSuccessResult<any>
	isFailure: (result: ExecutionResult) => result is ExecutionFailureResult<any>

	prependIssuePath: (issue: ExecutionIssue, path: ExecutionIssue['path']) => ExecutionIssue

	success: (value: Output) => ExecutionSuccessResult<Output>
	failure: (issue: Issue | Issue[]) => ExecutionFailureResult<Issue>
	createIssue: (content: {
		code: string
		payload: any
		path?: PropertyKey[] | undefined
		customMessage?: MessageHandler<any> | undefined
		defaultMessage?: MessageHandler<any> | undefined
	}) => Issue
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
		[M in keyof Def as IsStepMethodDef<Def[M]> extends true ? M : never]: Def[M]extends { Type: 'ExecutionStep', Meta: TStepMethodMeta, Method: AnyFn }
			? OverloadParametersAndReturnType<UnionToIntersection<Def[M]['Method']> extends infer Method extends AnyFn ? Method : never> extends infer MethodTuple extends [params: any[], ret: Use<Valchecker>]
				?	(
						payload: {
							utils: StepMethodUtils<
								InferOutput<Def[M]['Meta']['ExpectedCurrentValchecker']>,
								// If return type is Next<{ output: ... }>
								MethodTuple[1] extends Next<{ output: infer O }, any>
									// Extract the new output type
									? O
									// Fallback to current output type
									: InferOutput<ResolveExpectedThis<StepPluginDef>>,
								InferIssue<MethodTuple[1]>
							>
							params: MethodTuple[0]
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
	issue: ExpectedExecutionContext extends { issue: infer C extends ExecutionIssue } ? C : TExecutionContext['issue']
}>

export interface DefineStepMethodMeta<Meta extends {
	Name: string
	ExpectedCurrentValchecker: DefineExpectedValchecker<any>
	SelfIssue?: ExecutionIssue<`${Meta['Name']}:${string}`>
}> extends TStepMethodMeta {
	Name: Meta['Name']
	ExpectedCurrentValchecker: Meta['ExpectedCurrentValchecker']
	SelfIssue: Meta extends { SelfIssue: ExecutionIssue }
		? Meta['SelfIssue']
		: never
}

export interface DefineStepMethod<Meta extends TStepMethodMeta, Method extends AnyFn> { Type: 'ExecutionStep', Meta: Meta, Method: Method }

export type RegisteredStepMethodName<RegisteredStepPluginDefs extends TStepPluginDef> = Exclude<keyof UnionToIntersection<RegisteredStepPluginDefs>, 'CurrentValchecker'> extends infer N extends string ? N : never
export type UnknownExceptionIssue<M extends string = string> = ExecutionIssue<'core:unknown_exception', { method: M, value: unknown, error: unknown }>

export type InitialValchecker<RegisteredStepPluginDefs extends TStepPluginDef> = Use<Valchecker<{
	initial: true
	operationMode: 'sync'
	input: unknown
	output: unknown
	issue: UnknownExceptionIssue<RegisteredStepMethodName<RegisteredStepPluginDefs>>
}, RegisteredStepPluginDefs>>

export type MessageHandler<Issue extends ExecutionIssue = ExecutionIssue>
	=	| string
		| ((payload: Issue extends any
			? {
					code: Issue['code']
					payload: Issue['payload']
					path: NonNullable<Issue['path']>
				}
			: never,
		) => string | undefined | null)
		| UnionToIntersection<
			Issue extends any
				? Partial<Record<Issue['code'], (payload: {
					code: Issue['code']
					payload: Issue['payload']
					path: NonNullable<Issue['path']>
				}) => string>>
				: never
		>

export type ResolveMessageFn = (param: {
	data: {
		code: string
		payload: any
		path: PropertyKey[]
	}
	customMessage?: MessageHandler<any> | undefined
	defaultMessage?: MessageHandler<any> | undefined
}) => string
