import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Equal, ExecutionChain, IsAllPropsOptional, MaybePromise, Simplify } from '../shared'
import type { SchemaMessage as _SchemaMessage, UnknownErrorIssueCode } from './message'
import { createExecutionChain, createObject, NullProtoObj, returnFalse, throwNotImplementedError } from '../shared'
import { resolveMessage } from './message'

type SchemaMessage<T extends SchemaTypes = SchemaTypes> = _SchemaMessage<T['issueCode'], T['input']>

interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {}
interface ExecutionIssue extends StandardSchemaV1.Issue {
	readonly code: string
	readonly error?: unknown
}
interface ExecutionFailureResult extends StandardSchemaV1.FailureResult {
	readonly issues: ExecutionIssue[]
}
type ExecutionResult<Output> = ExecutionSuccessResult<Output> | ExecutionFailureResult

interface StandardProps<T extends SchemaTypes> extends StandardSchemaV1.Props<T['input'], T['output']> {
	readonly version: 1
	readonly vendor: 'valchecker'
}

type ExecutionUtils<Meta, Output, IssueCode extends string> = Equal<Output, never> extends true
	? {
			readonly meta: Meta
			readonly isTransformed: boolean
			readonly issue: (code: IssueCode, payload?: { path?: ExecutionIssue['path'], error?: unknown, message?: string }) => ExecutionIssue
			readonly failure: (issue: IssueCode | ExecutionIssue | ExecutionIssue[]) => ExecutionFailureResult
		}
	: {
			readonly meta: Meta
			readonly isTransformed: boolean
			readonly success: (value: Output) => ExecutionSuccessResult<Output>
			readonly issue: (code: IssueCode, payload?: { path?: ExecutionIssue['path'], error?: unknown, message?: string }) => ExecutionIssue
			readonly failure: (issue: IssueCode | ExecutionIssue | ExecutionIssue[]) => ExecutionFailureResult
		}

type AbstractSchemaConstructorPayload<T extends SchemaTypes> = Simplify<
	& (T['meta'] extends null ? unknown : { meta: T['meta'] })
	& { message?: SchemaMessage<T> }
>

/**
 * Base class for all schemas.
 */
abstract class AbstractSchema<T extends SchemaTypes = any> extends NullProtoObj implements StandardSchemaV1<T['input'], T['output']> {
	public readonly '~types': T = null!
	public meta: T['meta']
	private '~message': SchemaMessage<T>

	constructor(
		...params: IsAllPropsOptional<AbstractSchemaConstructorPayload<T>> extends true
			? [payload?: AbstractSchemaConstructorPayload<T>]
			: [payload: AbstractSchemaConstructorPayload<T>]
	) {
		super()
		const payload = params[0] || {} as any
		this.meta = (payload as any).meta
		this['~message'] = payload.message
	}

	private '~impl'(): any { throwNotImplementedError() }
	private get '~transformed'(): ((meta: this['meta']) => boolean) { return this['~impl']()['~transformed'] }
	private get '~defaultMessage'(): SchemaMessage<T> { return this['~impl']()['~defaultMessage'] }
	private get '~execute'(): (value: T['input'], utils: ExecutionUtils<T['meta'], T['output'], T['issueCode']>) => ExecutionResult<T['output']> | ExecutionChain<ExecutionResult<T['output']>> { return this['~impl']()['~validate'] }

	get '~standard'(): StandardProps<T> { return this['~impl']()['~standard'] }
	get isTransformed() { return this['~transformed'](this.meta) }

	execute(value: T['input']): ExecutionResult<T['output']> {
		const utils = createObject({
			meta: this.meta,
			isTransformed: this.isTransformed,
			success: value => ({ value }),
			issue: (code, { path, error, message } = {}) => ({
				code,
				message: message || resolveMessage({
					payload: { code, value, path, error },
					defaultMessage: this['~defaultMessage'],
					message: this['~message'],
				}),
				path,
				error,
			}),
			failure: (issue) => {
				if (typeof issue === 'string')
					return { issues: [utils.issue(issue)] }
				if (Array.isArray(issue))
					return { issues: issue }
				return { issues: [issue as any] }
			},
		} as ExecutionUtils<T['meta'], T['output'], T['issueCode']>)
		return createExecutionChain()
			.then(() => this['~execute'](value, utils))
			.then(
				result => result,
				error => ({ issues: [utils.issue('UNKNOWN_ERROR', { error })] }),
			)
	}

	isValid(value: T['input']): InferIsValidReturn<this> {
		const result = this.execute(value)
		if (result instanceof Promise) {
			return result.then(isSuccessResult) as any
		}
		return isSuccessResult(result) as any
	}
}

const standard = createObject<any>({
	version: 1,
	vendor: 'valchecker',
	/* v8 ignore next 3 */
	validate(this: any, value: unknown) {
		return this.execute(value)
	},
})

function implementSchemaClass<Schema extends AbstractSchema>(
	Class: new (...args: any[]) => Schema,
	{
		isTransformed,
		defaultMessage,
		execute,
	}: {
		isTransformed?: Schema['~transformed']
		defaultMessage?: Schema['~defaultMessage']
		execute: Schema['~execute']
	},
) {
	const impl = createObject<any>({
		'~standard': standard,
		'~transformed': isTransformed || returnFalse,
		'~defaultMessage': defaultMessage,
		'~execute': execute,
	})
	Class.prototype['~impl'] = () => impl
}

interface _RawSchemaTypesParam {
	Async?: boolean
	Transformed?: boolean
	Meta?: any
	Input?: any
	Output?: any
	IssueCode?: string
}

interface _ResolvedSchemaTypesParam {
	Async: any
	Transformed: any
	Meta: any
	Input: any
	Output: any
	IssueCode: string
	Result: MaybePromise<ExecutionResult<any>>
}

interface ResolvedSchemaTypesParam<P extends _RawSchemaTypesParam> extends _ResolvedSchemaTypesParam {
	Async: Equal<P, any> extends true
		? boolean
		: P extends { Async: infer Async extends boolean } ? Async : false
	Transformed: Equal<P, any> extends true
		? boolean
		: P extends { Transformed: infer Transformed extends boolean } ? Transformed : false
	Meta: Equal<P, any> extends true
		? any
		: P extends { Meta: infer Meta } ? Meta : null
	Input: Equal<P, any> extends true
		? any
		: P extends { Input: infer Input } ? Input : unknown
	Output: Equal<P, any> extends true
		? any
		: P extends { Output: infer Output } ? Output : this['Input']
	IssueCode: Equal<P, any> extends true
		? string
		: (P extends { IssueCode: infer IssueCode extends string } ? IssueCode : never) | UnknownErrorIssueCode | (string & {})
	Result: [
		true extends this['Async']
			? Promise<ExecutionResult<this['Output']>>
			: never,
		false extends this['Async']
			? ExecutionResult<this['Output']>
			: never,
	][number]
}

interface _SchemaTypes<P extends _ResolvedSchemaTypesParam> extends StandardSchemaV1.Types<P['Input'], P['Output']> {
	readonly async: P['Async']
	readonly transformed: P['Transformed']
	readonly meta: P['Meta']
	readonly input: P['Input']
	readonly output: P['Output']
	readonly issueCode: P['IssueCode']
}

type SchemaTypes = _SchemaTypes<_ResolvedSchemaTypesParam>

type DefineSchemaTypes<P extends _RawSchemaTypesParam> = _SchemaTypes<ResolvedSchemaTypesParam<P>>

type InferAsync<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['async']
type InferTransformed<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['transformed']
type InferMeta<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['meta']
type InferInput<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['input']
type InferOutput<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['output']
type InferIssueCode<Schema extends (ValSchema | AbstractSchema)> = NonNullable<Schema['~types']>['issueCode']
type InferValidateReturn<Schema extends (ValSchema | AbstractSchema)>
= (true extends InferAsync<Schema>
	? Promise<ExecutionResult<InferOutput<Schema>>>
	: never)
| (false extends InferAsync<Schema>
	? ExecutionResult<InferOutput<Schema>>
	: never)
type InferIsValidReturn<Schema extends (ValSchema | AbstractSchema)>
= (true extends InferAsync<Schema>
	? Promise<ExecutionResult<InferOutput<Schema>>>
	: never)
| (false extends InferAsync<Schema>
	? ExecutionResult<InferOutput<Schema>>
	: never)

type ValSchema<Output = any> = AbstractSchema<{
	readonly async: any
	readonly transformed: any
	readonly meta: any
	readonly input: any
	readonly output: Output
	readonly issueCode: any
}>

type UntransformedValSchema<Input = any, Output = Input> = AbstractSchema<{
	readonly async: any
	readonly transformed: false
	readonly meta: any
	readonly input: Input
	readonly output: Output
	readonly issueCode: any
}>

function prependIssuePath(issue: ExecutionIssue, path: PropertyKey[]): ExecutionIssue {
	return {
		...issue,
		path: [...path, ...(issue.path || [])],
	}
}

function isSuccessResult<Output = any>(result: ExecutionResult<Output>): result is ExecutionSuccessResult<Output> {
	return 'value' in result
}

export type {
	DefineSchemaTypes,
	ExecutionFailureResult,
	ExecutionIssue,
	ExecutionResult,
	ExecutionSuccessResult,
	InferAsync,
	InferInput,
	InferIssueCode,
	InferIsValidReturn,
	InferMeta,
	InferOutput,
	InferTransformed,
	InferValidateReturn,
	SchemaMessage,
	SchemaTypes,
	UntransformedValSchema,
	ValSchema,
}

export {
	AbstractSchema,
	implementSchemaClass,
	isSuccessResult,
	prependIssuePath,
}
