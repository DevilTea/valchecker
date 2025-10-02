// import type { StandardSchemaV1 } from '@standard-schema/spec'
// import type { AnyFn, Equal, MaybePromise, OverloadParameters, OverloadReturnType, Simplify } from '../shared'

// export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> { }
// export interface ExecutionIssue<IssueCode extends string = string> extends StandardSchemaV1.Issue {
// 	readonly code: IssueCode
// 	readonly error?: unknown
// }
// export interface ExecutionFailureResult extends StandardSchemaV1.FailureResult {
// 	readonly issues: ExecutionIssue[]
// }
// export type ExecutionResult<Output> = ExecutionSuccessResult<Output> | ExecutionFailureResult

// // T type
// export interface TSchemaContext {
// 	async: boolean
// 	input: unknown
// 	output: unknown
// 	issueCode: string
// 	history: TSchemaContextHistoryItem[]
// }

// export type TSchemaContextHistoryItem = Omit<TSchemaContext, 'history'>

// export type TSchemaContextPatch = Partial<Omit<TSchemaContext, 'history'>>

// export interface TValchecker {
// 	'~core': {
// 		schemaContext: TSchemaContext
// 		registeredSchemaId: string | null
// 	}
// }

// // Infering
// export type InferSchemaContext<V extends TValchecker> = V['~core']['schemaContext']
// export type InferAsync<V extends TValchecker> = InferSchemaContext<V>['async']
// export type InferInput<V extends TValchecker> = InferSchemaContext<V>['input']
// export type InferOutput<V extends TValchecker> = InferSchemaContext<V>['output']
// export type InferIssueCode<V extends TValchecker> = InferSchemaContext<V>['issueCode']

// export type InferRegisteredSchemaId<V extends TValchecker> = V['~core']['registeredSchemaId'] extends string
// 	? V['~core']['registeredSchemaId']
// 	: never

// type PatchSchemaContext<CurrentSchemaContext extends TSchemaContext, Patch extends TSchemaContextPatch> = (
// 	Equal<CurrentSchemaContext, any> extends true
// 		? {
// 				async: Patch extends { async: infer A extends boolean } ? A : boolean
// 				input: Patch extends { input: infer I } ? I : unknown
// 				output: Patch extends { output: infer O } ? O : unknown
// 				issueCode: Patch extends { issueCode: infer C extends string } ? C : string
// 				history: TSchemaContextHistoryItem[]
// 			}
// 		: {
// 				async: Patch extends { async: infer A extends boolean }
// 					? (CurrentSchemaContext['async'] | A) extends false ? false : true
// 					: CurrentSchemaContext['async']
// 				input: Patch extends { input: infer I }
// 					? I
// 					: CurrentSchemaContext['input']
// 				output: Patch extends { output: infer O }
// 					? O
// 					: CurrentSchemaContext['output']
// 				issueCode: Patch extends { issueCode: infer C extends string }
// 					? (CurrentSchemaContext['issueCode'] | C)
// 					: CurrentSchemaContext['issueCode']
// 				history: [...CurrentSchemaContext['history'], Simplify<Omit<CurrentSchemaContext, 'history'>>]
// 			}
// ) extends infer PatchedSchemaContext extends TSchemaContext
// 	? PatchedSchemaContext
// 	: never

// type ExpectedValchecker<ExpectedSchemaContext extends Partial<TSchemaContext>> = Valchecker<{
// 	async: ExpectedSchemaContext extends { async: infer A extends boolean } ? A : TSchemaContext['async']
// 	input: ExpectedSchemaContext extends { input: infer I } ? I : TSchemaContext['input']
// 	output: ExpectedSchemaContext extends { output: infer O } ? O : TSchemaContext['output']
// 	issueCode: ExpectedSchemaContext extends { issueCode: infer C extends string } ? C : TSchemaContext['issueCode']
// 	history: ExpectedSchemaContext extends { history: infer H extends TSchemaContextHistoryItem[] } ? H : TSchemaContextHistoryItem[]
// }>

// type ExtractSchemaMethods<Instance extends Valchecker> = {
// 	// Filtered to only registered schema definitions
// 	[P in keyof Instance as P extends `~(schema) ${InferRegisteredSchemaId<Instance>}`
// 		// Ensure it's an available method for current instance
// 		? [Instance[P]] extends [never]
// 				? never
// 				: P extends `~(schema) ${string}:${infer MethodName extends string}`
// 					? MethodName
// 					: never
// 		: never
// 	]: Instance[P]
// }

// type Use<Instance extends Valchecker> = Omit<
// 	Instance,
// 	`~(schema) ${string}`
// > & ExtractSchemaMethods<Instance>

// type Next<
// 	Patch extends TSchemaContextPatch,
// 	This extends Valchecker,
// 	ExpectedThis extends Valchecker,
// > = Use<Valchecker<
// 	PatchSchemaContext<InferSchemaContext<This>, Patch>,
// 	InferRegisteredSchemaId<This>
// >> & { '~temp': { expectedThis: ExpectedThis, patch: Patch } }

// type AnyValchecker = Valchecker<any, any>

// // Schema Plugin
// type AllSchemaId = keyof { [P in keyof Valchecker as P extends `~(schema) ${infer SchemaId extends string}` ? SchemaId : never]: any }

// interface SchemaMethodUtils<
// 	Input,
// 	IssueCode extends string,
// > {
// 	addStep: (fn: (lastResult: ExecutionResult<Input>) => MaybePromise<ExecutionResult<any>>) => void
// 	addSuccessStep: (fn: (value: Input) => MaybePromise<ExecutionResult<any>>) => void
// 	addFailureStep: (fn: (issues: ExecutionIssue[]) => MaybePromise<ExecutionResult<any>>) => void

// 	isSuccess: (result: ExecutionResult<any>) => result is ExecutionSuccessResult<any>
// 	isFailure: (result: ExecutionResult<any>) => result is ExecutionFailureResult

// 	prependIssuePath: (issue: ExecutionIssue, path: ExecutionIssue['path']) => ExecutionIssue

// 	success: (value: any) => ExecutionSuccessResult<any>
// 	failure: (issue: IssueCode | ExecutionIssue | ExecutionIssue[]) => ExecutionFailureResult
// 	issue: (code: IssueCode, payload?: { path?: ExecutionIssue['path'], error?: unknown, message?: string }) => ExecutionIssue
// }

// export type SchemaPlugin<SchemaId extends AllSchemaId = AllSchemaId> = SchemaId extends AllSchemaId
// 	? {
// 			id: SchemaId
// 			implement: AnyValchecker[`~(schema) ${SchemaId}`] extends infer MethodDef extends AnyFn
// 				? (
// 						utils: SchemaMethodUtils<
// 							OverloadReturnType<MethodDef> extends { '~temp': { expectedThis: infer E extends Valchecker } }
// 								? InferOutput<E>
// 								: unknown,
// 							InferIssueCode<OverloadReturnType<MethodDef>>
// 						>,
// 						params: OverloadParameters<MethodDef>,
// 					) => void
// 				: never
// 		}
// 	: never

// interface Valchecker<
// 	CurrentSchemaContext extends TSchemaContext = TSchemaContext,
// 	RegisteredSchemaId extends string | null = string | null,
// > extends StandardSchemaV1<
// 	InferInput<{ '~core': { schemaContext: CurrentSchemaContext, registeredSchemaId: RegisteredSchemaId } }>,
// 	InferOutput<{ '~core': { schemaContext: CurrentSchemaContext, registeredSchemaId: RegisteredSchemaId } }>
// > {
// 	readonly '~core': {
// 		schemaContext: CurrentSchemaContext
// 		registeredSchemaId: RegisteredSchemaId
// 	}
// }

// export interface InitialSchemaContext {
// 	async: false
// 	input: unknown
// 	output: unknown
// 	issueCode: never
// 	history: []
// }

// export type InitialValchecker<RegisteredSchemaId extends string | null> = Use<Valchecker<InitialSchemaContext, RegisteredSchemaId>>

// export function createValchecker<Plugins extends SchemaPlugin[]>({
// 	plugins,
// }: {
// 	plugins: [...Plugins]
// }) {
// 	const _schemaMethods = plugins.reduce((acc, plugin) => {
// 		return acc
// 	}, {} as Record<string, any>)
// 	return {} as InitialValchecker<Plugins extends [] ? null : Plugins[number]['id']>
// }

// // demo

// type NumberSchemaExpectedThis = ExpectedValchecker<InitialSchemaContext>
// type NumberSchema<This> = This extends NumberSchemaExpectedThis
// 	? () => Next<{ output: number, issueCode: 'expected_number' }, This, NumberSchemaExpectedThis>
// 	: never

// type ToStringSchemaExpectedThis = ExpectedValchecker<{ output: { toString: (...params: any[]) => string } }>
// type ToStringSchema<This> = This extends ToStringSchemaExpectedThis
// 	? (...params: Parameters<InferOutput<This>['toString']>) => Next<{ output: string }, This, ToStringSchemaExpectedThis>
// 	: never

// interface Valchecker {
// 	'~(schema) core:number': NumberSchema<this>
// 	'~(schema) core:toString': ToStringSchema<this>
// }

// const number = {
// 	id: 'core:number',
// 	implement: (utils) => {
// 		utils.addSuccessStep(v => typeof v === 'number'
// 			? utils.success(v)
// 			: utils.failure('expected_number'))
// 	},
// } satisfies SchemaPlugin<'core:number'>

// const toString = {
// 	id: 'core:toString',
// 	implement: (utils, params) => {
// 		utils.addSuccessStep(v => utils.success(v.toString(...params)))
// 	},
// } satisfies SchemaPlugin<'core:toString'>

// declare const v: InitialValchecker<AllSchemaId>

// const s = v.number().toString()
