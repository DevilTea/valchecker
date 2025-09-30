import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { MaybePromise, Merge } from '../shared'

export namespace Valchecker {
	export interface TSchemaContext {
		async: boolean
		input: unknown
		output: unknown
		issueCode: string
	}

	export interface TSchemaContextPatch {
		async?: boolean
		input?: unknown
		output?: unknown
		issueCode?: string
	}

	export interface TValchecker {
		readonly '~valchecker': {
			schemaContext: TSchemaContext | null
			registeredPluginIds: string | null
		}
	}

	export type NextStep<
		T extends Valchecker,
		PatchFromSchemaMethod extends SchemaMethodName,
		ExtraPatch extends TSchemaContextPatch = never,
	> = (
		Merge<T[PatchFromSchemaMethod]['patch'], ExtraPatch> extends infer Patch extends TSchemaContextPatch
			? [Patch] extends [never]
					? { async: InferAsync<T>, input: InferInput<T>, output: InferOutput<T> }
					: {
							async: InferAsync<T> extends false
								? Patch extends ({ async: infer A extends boolean }) ? A : InferAsync<T>
								: InferAsync<T>
							input: Patch extends ({ input: infer A extends unknown })
								? A
								: InferInput<T>
							output: Patch extends ({ output: infer A extends unknown })
								? A
								: InferOutput<T>
							issueCode: Patch extends ({ issueCode: infer A extends string })
								? InferIssueCode<T> | A
								: InferIssueCode<T>
						}
			: { async: InferAsync<T>, input: InferInput<T>, output: InferOutput<T> }
	) extends infer NewSchemaContext extends TSchemaContext
		? Use<Valchecker<NewSchemaContext, InferPlugins<T>>>
		: never

	export type ConditionSchemaContext<C extends Partial<TSchemaContext> | null> = C extends null
		? null
		: {
				async: C extends { async: infer A extends boolean } ? A : boolean
				input: C extends { input: infer I } ? I : unknown
				output: C extends { output: infer O } ? O : unknown
				issueCode: string
			}

	export type InferSchemaContext<T extends TValchecker> = T['~valchecker']['schemaContext']

	export type InferAsync<T extends TValchecker> = InferSchemaContext<T> extends infer Ctx extends TSchemaContext
		? Ctx['async']
		: false

	export type InferInput<T extends TValchecker> = InferSchemaContext<T> extends infer Ctx extends TSchemaContext
		? Ctx['input']
		: unknown

	export type InferOutput<T extends TValchecker> = InferSchemaContext<T> extends infer Ctx extends TSchemaContext
		? Ctx['output']
		: unknown

	export type InferIssueCode<T extends TValchecker> = InferSchemaContext<T> extends infer Ctx extends TSchemaContext
		? Ctx['issueCode']
		: never

	export type InferSchemaMethodIssueCode<MethodName extends SchemaMethodName> = Valchecker[MethodName]['issueCode']

	export type InferPlugins<T extends TValchecker> = T['~valchecker']['registeredPluginIds']

	type IsOmittedSchemaMethod<Fn, CurrentSchemaContext extends TSchemaContext | null> = Fn extends ((...params: any[]) => any)
		? Fn extends Omit<TSchemaMethodMeta, 'patch'>
			? CurrentSchemaContext extends Fn['condition']['schemaContext']
				? false
				// Exclude methods that not match the current schema context
				: true
			: false
		: false

	type OmittedSchemaMethodName<Instance extends Valchecker> = keyof {
		[M in keyof Instance as Instance[M] extends { pluginId: infer PluginId extends string }
			? PluginId extends InferPlugins<Instance>
				? IsOmittedSchemaMethod<Instance[M], InferSchemaContext<Instance>> extends true
					? M
					: never
				// Exclude methods from unregistered plugins
				: M
			// Keep non-plugin methods
			: never
		]: any
	}

	export type Use<Instance extends Valchecker> = Omit<
		Instance,
		| OmittedSchemaMethodName<Instance>
		| (InferSchemaContext<Instance> extends null ? never : ('execute' | 'isSuccess' | 'isFailure'))
	>

	export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {}
	export interface ExecutionIssue<IssueCode extends string = string> extends StandardSchemaV1.Issue {
		readonly code: IssueCode
		readonly error?: unknown
	}
	export interface ExecutionFailureResult extends StandardSchemaV1.FailureResult {
		readonly issues: ExecutionIssue[]
	}
	export type ExecutionResult<Output> = ExecutionSuccessResult<Output> | ExecutionFailureResult

	export interface TSchemaMethodMeta {
		pluginId: string
		condition: {
			schemaContext: Partial<TSchemaContext> | null
		}
		issueCode: string
		patch: Omit<TSchemaContextPatch, 'issueCode'>
	}

	export type DefineSchemaMethod<
		Meta extends TSchemaMethodMeta,
		Method extends (this: Valchecker<ConditionSchemaContext<Meta['condition']['schemaContext']>>, ...params: any[]) => Valchecker.Use<Valchecker>,
	> = Method
		& { type: 'schema' }
		& Merge<Meta, { patch: Merge<Meta['patch'], { issueCode: Meta['issueCode'] }> }>

	type CandidatePluginId = keyof { [M in keyof Valchecker as Valchecker[M] extends { pluginId: string } ? Valchecker[M]['pluginId'] : never]: any }
	type SchemaMethodName<Id extends CandidatePluginId = CandidatePluginId> = keyof { [M in keyof Valchecker as Valchecker[M] extends { pluginId: Id, type: 'schema', issueCode: string, patch: TSchemaContextPatch } ? M : never]: any }

	export namespace Plugin {
		export interface SchemaMethodUtils<
			LastSchemaContext extends TSchemaContext,
			IssueCode extends string,
		> {
			addStep: (fn: (lastResult: ExecutionResult<LastSchemaContext['output']>) => MaybePromise<ExecutionResult<any>>) => void
			addSuccessStep: (fn: (value: LastSchemaContext['output']) => MaybePromise<ExecutionResult<any>>) => void
			addFailureStep: (fn: (issues: ExecutionIssue[]) => MaybePromise<ExecutionResult<any>>) => void

			isSuccess: (result: ExecutionResult<any>) => result is ExecutionSuccessResult<any>
			isFailure: (result: ExecutionResult<any>) => result is ExecutionFailureResult

			prependIssuePath: (issue: ExecutionIssue, path: ExecutionIssue['path']) => ExecutionIssue

			success: (value: any) => ExecutionSuccessResult<any>
			failure: (issue: IssueCode | ExecutionIssue | ExecutionIssue[]) => ExecutionFailureResult
			issue: (code: IssueCode, payload?: { path?: ExecutionIssue['path'], error?: unknown, message?: string }) => ExecutionIssue
		}
	}

	export interface Plugin<Id extends CandidatePluginId = CandidatePluginId> {
		id: Id
		implement: {
			schemaMethods?: {
				[M in SchemaMethodName<Id>]?: (
					utils: Plugin.SchemaMethodUtils<
						{
							async: Valchecker[M]['condition']['schemaContext'] extends { async: infer A extends boolean } ? A : boolean
							input: Valchecker[M]['condition']['schemaContext'] extends { input: infer I } ? I : unknown
							output: Valchecker[M]['condition']['schemaContext'] extends { output: infer O } ? O : unknown
							issueCode: string
						},
						Valchecker[M]['issueCode']
					>,
					...params: Parameters<Valchecker<ConditionSchemaContext<Valchecker[M]['condition']['schemaContext']>>[M]>
				) => void
			}
		}
	}
}

export interface Valchecker<
	SchemaContext extends Valchecker.TSchemaContext | null = Valchecker.TSchemaContext | null,
	RegisteredPluginIds extends string | null = string | null,
> extends StandardSchemaV1<
	Valchecker.InferInput<{ '~valchecker': { schemaContext: SchemaContext, registeredPluginIds: RegisteredPluginIds } }>,
	Valchecker.InferOutput<{ '~valchecker': { schemaContext: SchemaContext, registeredPluginIds: RegisteredPluginIds } }>
> {
	// Private API
	readonly '~valchecker': {
		schemaContext: SchemaContext
		registeredPluginIds: RegisteredPluginIds
		queue: unknown[]
		execute: (value: Valchecker.InferInput<{ '~valchecker': { schemaContext: SchemaContext, registeredPluginIds: RegisteredPluginIds } }>) => MaybePromise<Valchecker.ExecutionResult<Valchecker.InferOutput<{ '~valchecker': { schemaContext: SchemaContext, registeredPluginIds: RegisteredPluginIds } }>>>
	}

	// Public API
	'execute': <Schema extends Valchecker.Use<Valchecker>>(schema: Schema, value: unknown) => Valchecker.InferAsync<Schema> extends false
		? Valchecker.ExecutionResult<Valchecker.InferOutput<Schema>>
		: Promise<Valchecker.ExecutionResult<Valchecker.InferOutput<Schema>>>

	'isSuccess': (result: Valchecker.ExecutionResult<any>) => result is Valchecker.ExecutionSuccessResult<any>
	'isFailure': (result: Valchecker.ExecutionResult<any>) => result is Valchecker.ExecutionFailureResult
}

export function createValchecker<Plugins extends Valchecker.Plugin[]>({
	plugins,
}: {
	plugins: [...Plugins]
}) {
	const _schemaMethods = plugins.reduce((acc, plugin) => {
		return plugin.implement.schemaMethods
			? { ...acc, ...plugin.implement.schemaMethods }
			: acc
	}, {} as Record<string, any>)
	return {} as Valchecker.Use<Valchecker<null, Plugins extends [] ? null : Plugins[number]['id']>>
}
