// import type { StandardSchemaV1 } from '@standard-schema/spec'
// import type { AnyFn, IsEqual, MaybePromise, OverloadParametersAndReturnType, Simplify, UnionToIntersection } from '../shared'

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
// type TSchemaDef = {
// 	[K in string]: K extends 'This'
// 		? unknown
// 		: (meta: any, method: any) => void;
// }

// export interface TSchemaContext {
// 	async: boolean
// 	input: unknown
// 	output: unknown
// 	issueCode: string
// }

// export type TSchemaContextPatch = Partial<TSchemaContext>

// export type TRegisteredSchemaMethods = Record<string, any>

// export interface TValchecker {
// 	'~core': {
// 		schemaContext: TSchemaContext
// 		registeredSchemaDefs: TSchemaDef
// 	}
// }

// // Infering
// export type InferSchemaContext<V extends TValchecker> = V['~core']['schemaContext']
// export type InferAsync<V extends TValchecker> = InferSchemaContext<V>['async']
// export type InferInput<V extends TValchecker> = InferSchemaContext<V>['input']
// export type InferOutput<V extends TValchecker> = InferSchemaContext<V>['output']
// export type InferIssueCode<V extends TValchecker> = InferSchemaContext<V>['issueCode']
// export type InferRegisteredSchemaDefs<V extends TValchecker> = V['~core']['registeredSchemaDefs']

// type PatchSchemaContext<CurrentSchemaContext extends TSchemaContext, Patch extends TSchemaContextPatch> = (
// 	IsEqual<CurrentSchemaContext, any> extends true
// 		? {
// 				async: Patch extends { async: infer A extends boolean } ? A : boolean
// 				input: Patch extends { input: infer I } ? I : unknown
// 				output: Patch extends { output: infer O } ? O : unknown
// 				issueCode: Patch extends { issueCode: infer C extends string } ? C : string
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
// 			}
// ) extends infer PatchedSchemaContext extends TSchemaContext
// 	? PatchedSchemaContext
// 	: never

// type ExpectedValchecker<ExpectedSchemaContext extends Partial<TSchemaContext>> = Valchecker<{
// 	async: ExpectedSchemaContext extends { async: infer A extends boolean } ? A : TSchemaContext['async']
// 	input: ExpectedSchemaContext extends { input: infer I } ? I : TSchemaContext['input']
// 	output: ExpectedSchemaContext extends { output: infer O } ? O : TSchemaContext['output']
// 	issueCode: ExpectedSchemaContext extends { issueCode: infer C extends string } ? C : TSchemaContext['issueCode']
// }>

// type IsSchemaMethodDef<M> = M extends AnyFn
// 	? IsEqual<Parameters<M>[1], null> extends true
// 		? false
// 		: Parameters<M>[0] extends { type: 'schema' }
// 			? true
// 			: false
// 	: false

// type ResolveSchemaDefs<Instance extends Valchecker> = UnionToIntersection<InferRegisteredSchemaDefs<Instance>> & { This: Instance }

// type ExtractSchemaMethods<Instance extends Valchecker> = ResolveSchemaDefs<Instance> extends infer SchemaDefs
// 	? {
// 			[M in keyof SchemaDefs as IsSchemaMethodDef<SchemaDefs[M]> extends true ? M : never]: SchemaDefs[M] extends AnyFn
// 				? Parameters<SchemaDefs[M]>[1]
// 				: never
// 		}
// 	: never

// type Use<Instance extends Valchecker> = Instance & ExtractSchemaMethods<Instance>

// type Next<
// 	This extends TValchecker,
// 	Patch extends TSchemaContextPatch,
// > = Use<Valchecker<
// 	PatchSchemaContext<InferSchemaContext<This>, Patch>,
// 	InferRegisteredSchemaDefs<This>
// >>

// interface Valchecker<
// 	CurrentSchemaContext extends TSchemaContext = TSchemaContext,
// 	RegisteredSchemaDefs extends TSchemaDef = TSchemaDef,
// > extends StandardSchemaV1<
// 	InferInput<{ '~core': { schemaContext: CurrentSchemaContext, registeredSchemaDefs: RegisteredSchemaDefs } }>,
// 	InferOutput<{ '~core': { schemaContext: CurrentSchemaContext, registeredSchemaDefs: RegisteredSchemaDefs } }>
// > {
// 	readonly '~core': {
// 		schemaContext: CurrentSchemaContext
// 		registeredSchemaDefs: RegisteredSchemaDefs
// 	}
// }

// export interface InitialSchemaContext {
// 	async: false
// 	input: unknown
// 	output: unknown
// 	issueCode: never
// }

// export type InitialValchecker<RegisteredSchemaDefs extends TSchemaDef> = Use<Valchecker<InitialSchemaContext, RegisteredSchemaDefs>>

// export function createValchecker<SchemaDefs extends TSchemaDef[]>({
// 	schemas,
// }: {
// 	schemas: [...SchemaDefs]
// }) {
// 	const _schemaMethods = schemas.reduce((acc, schema) => {
// 		return acc
// 	}, {} as Record<string, any>)
// 	return {} as InitialValchecker<Plugins extends [] ? null : Plugins[number]['id']>
// }

// // Schema Plugin
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

// type SchemaImpl<SchemaDef extends TSchemaDef> = ResolveSchemaDefs<Valchecker<any, SchemaDef>> extends infer SchemaDefs
// 	? {
// 			[M in keyof SchemaDefs as IsSchemaMethodDef<SchemaDefs[M]> extends true ? M : never]: SchemaDefs[M] extends AnyFn
// 				? Simplify<{
// 					Input: Parameters<SchemaDefs[M]>[0] extends { ExpectedThis: TValchecker }
// 						? InferOutput<Parameters<SchemaDefs[M]>[0]['ExpectedThis']>
// 						: unknown
// 					IssueCode: Parameters<SchemaDefs[M]>[1] extends (...params: any[]) => Next<any, infer Patch extends TSchemaContextPatch>
// 						? Patch extends { issueCode: infer C extends string } ? C : never
// 						: never
// 				}> extends infer Meta extends { type: 'schema', ExpectedThis: TValchecker, Patch: TSchemaContextPatch }
// 					? () => void
// 					: never
// 				: never
// 		}
// 	: never

// interface NumberSchemaDef extends TSchemaDef {
// 	number: ((
// 		meta: {
// 			type: 'schema'
// 			ExpectedThis: ExpectedValchecker<InitialSchemaContext>
// 		},
// 		method: this['This'] extends typeof meta['ExpectedThis']
// 			? () => Next<this['This'], { output: number, issueCode: 'expected_number' }>
// 			: null
// 	) => void)
// 	& ((
// 		meta: {
// 			type: 'schema'
// 			ExpectedThis: ExpectedValchecker<InitialSchemaContext>
// 		},
// 		method: this['This'] extends typeof meta['ExpectedThis']
// 			? (n: number) => Next<this['This'], { output: number, issueCode: 'expected_number' }>
// 			: null
// 	) => void)

// 	/**
// 	 * number schema with NaN allowed
// 	 */
// 	looseNumber: (
// 		meta: {
// 			type: 'schema'
// 			ExpectedThis: ExpectedValchecker<InitialSchemaContext>
// 		},
// 		method: this['This'] extends typeof meta['ExpectedThis']
// 			? () => Next<this['This'], { output: number, issueCode: 'expected_loose_number' }>
// 			: null
// 	) => void
// }

// type AAA = OverloadParametersAndReturnType<(NumberSchemaDef & { This: Valchecker<any> })['number']> extends infer Tuple extends [any, any]
// 	? Tuple extends any
// 		? Tuple[0][0]
// 		: never
// 	: never

// const number = {
// 	number: () => { },
// 	looseNumber: () => { },
// } satisfies SchemaImpl<NumberSchemaDef>

// const toString = {
// 	toString: () => { },
// } satisfies SchemaImpl<ToStringSchemaDef>

// interface StringSchemaDef extends TSchemaDef {
// 	/**
// 	 * string schema
// 	 */
// 	string: (
// 		meta: {
// 			type: 'schema'
// 			ExpectedThis: ExpectedValchecker<InitialSchemaContext>
// 		},
// 		method: this['This'] extends typeof meta['ExpectedThis']
// 			? () => Next<this['This'], { output: string, issueCode: 'expected_string' }>
// 			: null
// 	) => void
// }

// interface ToStringSchemaDef extends TSchemaDef {
// 	toString: (
// 		meta: {
// 			type: 'schema'
// 			ExpectedThis: ExpectedValchecker<{ output: { toString: (...params: any[]) => string } }>
// 		},
// 		method: this['This'] extends typeof meta['ExpectedThis']
// 			? (...params: Parameters<InferOutput<this['This']>['toString']>) => Next<this['This'], { output: string }>
// 			: null
// 	) => void
// }

// declare const v: InitialValchecker<NumberSchemaDef | StringSchemaDef | ToStringSchemaDef>

// v.number()
