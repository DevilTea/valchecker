// import type { StandardSchemaV1 } from '@standard-schema/spec'
// import type { AnyFn, Equal, GetProp, MaybePromise, UnionToIntersection } from '../shared'

// export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {}
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
// }

// export type TSchemaContextPatch = Partial<TSchemaContext>

// export interface TValchecker {
// 	'~core': {
// 		schemaContext: TSchemaContext | null
// 		registeredPluginId: string | null
// 	}
// }

// // Infering
// export type InferSchemaContext<V extends TValchecker> = V['~core']['schemaContext']
// export type InferAsync<V extends TValchecker> = InferSchemaContext<V> extends TSchemaContext
// 	? InferSchemaContext<V>['async']
// 	: false
// export type InferInput<V extends TValchecker> = InferSchemaContext<V> extends TSchemaContext
// 	? InferSchemaContext<V>['input']
// 	: unknown
// export type InferOutput<V extends TValchecker> = InferSchemaContext<V> extends TSchemaContext
// 	? InferSchemaContext<V>['output']
// 	: unknown
// export type InferIssueCode<V extends TValchecker> = InferSchemaContext<V> extends TSchemaContext
// 	? InferSchemaContext<V>['issueCode']
// 	: never
// export type InferRegisteredPluginId<V extends TValchecker> = V['~core']['registeredPluginId'] extends string
// 	? V['~core']['registeredPluginId']
// 	: never

// type PatchSchemaContext<CurrentSchemaContext extends TSchemaContext | null, Patch extends TSchemaContextPatch> = (
// 	Equal<CurrentSchemaContext, any> extends true ? {
// 		async: Patch extends { async: infer A extends boolean } ? A : boolean
// 		input: Patch extends { input: infer I } ? I : unknown
// 		output: Patch extends { output: infer O } ? O : unknown
// 		issueCode: Patch extends { issueCode: infer C extends string } ? C : never
// 	} : CurrentSchemaContext extends TSchemaContext ? {
// 		async: Patch extends { async: infer A extends boolean }
// 			? (A | CurrentSchemaContext['async']) extends false
// 					? false
// 					: true
// 			: CurrentSchemaContext['async']
// 		input: Patch extends { input: infer I } ? I : CurrentSchemaContext['input']
// 		output: Patch extends { output: infer O } ? O : CurrentSchemaContext['output']
// 		issueCode: Patch extends { issueCode: infer C extends string } ? (CurrentSchemaContext['issueCode'] | C) : CurrentSchemaContext['issueCode']
// 	} : {
// 		async: Patch extends { async: true } ? true : false
// 		input: Patch extends { input: infer I } ? I : unknown
// 		output: Patch extends { output: infer O } ? O : unknown
// 		issueCode: Patch extends { issueCode: infer C extends string } ? C : never
// 	}
// ) extends infer PatchedSchemaContext extends TSchemaContext
// 	? PatchedSchemaContext
// 	: never

// type ExpectedValchecker<ExpectedSchemaContext extends Partial<TSchemaContext> | null> = ExpectedSchemaContext extends null
// 	? Valchecker<null>
// 	: Valchecker<{
// 		async: ExpectedSchemaContext extends { async: infer A extends boolean } ? A : TSchemaContext['async']
// 		input: ExpectedSchemaContext extends { input: infer I } ? I : TSchemaContext['input']
// 		output: ExpectedSchemaContext extends { output: infer O } ? O : TSchemaContext['output']
// 		issueCode: ExpectedSchemaContext extends { issueCode: infer C extends string } ? C : TSchemaContext['issueCode']
// 	}>

// type ExtractSchemaMethods<Instance extends Valchecker> = UnionToIntersection<
// 	{
// 		[
// 		M in keyof Instance as M extends `~(plugin) ${string}`
// 			? M extends `~(plugin) ${InferRegisteredPluginId<Instance>}`
// 				? Equal<Instance[M], any> extends true
// 					? never
// 					: M
// 				: never
// 			: never
// 		]: Instance[M] extends { schemaMethods: infer S } ? S : never
// 	} extends infer O ? O[keyof O] : never
// > extends infer Methods
// 	? [Methods] extends [never]
// 			? unknown
// 			: Methods
// 	: never

// type Use<Instance extends Valchecker> = Omit<
// 	Instance,
// 	`~(plugin) ${string}`
// > & ExtractSchemaMethods<Instance>

// type Next<
// 	Instance extends Valchecker,
// 	Patch extends TSchemaContextPatch,
// > = Use<
// 	Valchecker<
// 		PatchSchemaContext<InferSchemaContext<Instance>, Patch>,
// 		InferRegisteredPluginId<Instance>
// 	>
// >

// type InitialValchecker<RegisteredPluginId extends string | null> = Use<Valchecker<null, RegisteredPluginId>>

// // Schema Plugin
// type AllSchemaPluginId = keyof { [P in keyof Valchecker as P extends `~(plugin) ${infer PluginId extends string}` ? PluginId : never]: any }

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
// type AnyValchecker = Valchecker<any, any>

// export type SchemaPlugin<PluginId extends AllSchemaPluginId = AllSchemaPluginId> = PluginId extends AllSchemaPluginId
// 	? {
// 			id: PluginId
// 			implement: {
// 				schemaMethods: GetProp<AnyValchecker[`~(plugin) ${PluginId}`], 'schemaMethods'> extends infer Methods extends Record<string, AnyFn>
// 					? {
// 							[M in keyof Methods]: (
// 								utils: SchemaMethodUtils<

// 								>,
// 								...params: Parameters<Methods[M]>
// 							) => void
// 						}
// 					: never
// 			}
// 		}
// 	: never

// interface Valchecker<
// 	CurrentSchemaContext extends TSchemaContext | null = TSchemaContext | null,
// 	RegisteredPluginId extends string | null = string | null,
// > extends StandardSchemaV1<
// 	InferInput<{ '~core': { schemaContext: CurrentSchemaContext, registeredPluginId: RegisteredPluginId } }>,
// 	InferOutput<{ '~core': { schemaContext: CurrentSchemaContext, registeredPluginId: RegisteredPluginId } }>
// > {
// 	readonly '~core': {
// 		schemaContext: CurrentSchemaContext
// 		registeredPluginId: RegisteredPluginId
// 	}
// 	[P: `~(plugin) ${string}`]: {
// 		schemaMethods: Record<string, any>
// 	}
// }

// interface Valchecker {
// 	'~(plugin) core:number': this extends infer This
// 		? {
// 				schemaMethods: This extends ExpectedValchecker<null>
// 					? {
// 							number: () => Next<This, { output: number, issueCode: 'core:not_number' }>
// 						}
// 					: Record<never, never>
// 			}
// 		: never
// }
// // const number = {
// // 	id: 'core:number',
// // 	implement: {
// // 		schemaMethods: {
// // 			number: (utils, n) => {},
// // 		},
// // 	},
// // } satisfies SchemaPlugin<'core:number'>

// interface Valchecker {
// 	'~(plugin) core:string': this extends infer This
// 		? {
// 				schemaMethods: This extends ExpectedValchecker<null>
// 					? { string: () => Next<This, { output: string }> }
// 					: Record<never, never>
// 			}
// 		: never
// }

// declare const v: InitialValchecker<'core:number' | 'core:string'>

// v.string()

// export function createValchecker<Plugins extends SchemaPlugin[]>({
// 	plugins,
// }: {
// 	plugins: [...Plugins]
// }) {
// 	const _schemaMethods = plugins.reduce((acc, plugin) => {
// 		return plugin.implement.schemaMethods
// 			? { ...acc, ...plugin.implement.schemaMethods }
// 			: acc
// 	}, {} as Record<string, any>)
// 	return {} as InitialValchecker<Plugins extends [] ? null : Plugins[number]['id']>
// }
