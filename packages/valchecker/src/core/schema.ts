import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Equal, IsAllPropsOptional, MaybePromise, Optional, Simplify } from '../utils'
import { createObject, ExecutionChain, NullProtoObj, throwNotImplementedError } from '../utils'
import { PipeSchema } from './pipe'

type SchemaMessageFn<T extends SchemaTypes> = (payload: { code: T['issueCode'], value: T['input'], path?: ValidationIssue['path'], error?: unknown }) => string
type SchemaMessageMap<T extends SchemaTypes> = Simplify<
	& Simplify<Partial<Record<UnknownErrorIssueCode, string | SchemaMessageFn<T>>>>
	& Simplify<Record<Exclude<T['issueCode'], UnknownErrorIssueCode>, string | SchemaMessageFn<T>>>
>
type SchemaMessage<T extends SchemaTypes = SchemaTypes> = string | SchemaMessageFn<T> | Partial<SchemaMessageMap<T>>
function _resolveMessage<T extends SchemaTypes>(payload: { code: T['issueCode'], value: any, path?: ValidationIssue['path'], error?: unknown }, message: Optional<SchemaMessage<T>>) {
	if (message == null)
		return void 0

	if (typeof message === 'string')
		return message

	if (typeof message === 'function')
		return message(payload)

	const _message = (message as any)[payload.code]

	return _resolveMessage(payload, _message)
}
function resolveMessage<T extends SchemaTypes>(payload: { code: T['issueCode'], value: any, path?: ValidationIssue['path'], error?: unknown }, defaultMessage: Optional<SchemaMessage<T>>, message: Optional<SchemaMessage<T>>) {
	const _message = _resolveMessage(payload, message)
	if (_message != null)
		return _message

	const _defaultMessage = _resolveMessage(payload, defaultMessage)
	if (_defaultMessage != null)
		return _defaultMessage

	return 'Invalid value'
}

interface ValidationSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {}
interface ValidationIssue extends StandardSchemaV1.Issue {
	readonly code: string
	readonly error?: unknown
}
interface ValidationFailureResult extends StandardSchemaV1.FailureResult {
	readonly issues: ValidationIssue[]
}
type ValidationResult<Output> = ValidationSuccessResult<Output> | ValidationFailureResult

interface StandardProps<T extends SchemaTypes> extends StandardSchemaV1.Props<T['input'], T['output']> {
	readonly version: 1
	readonly vendor: 'valchecker'
	readonly validate: (value: unknown) => T['result']
	readonly types?: T | undefined
}

interface ValidationUtils<T extends SchemaTypes> {
	readonly meta: T['meta']
	readonly isTransformed: boolean
	readonly success: (value: T['output']) => ExecutionChain<ValidationSuccessResult<T['output']>>
	readonly issue: (code: T['issueCode'], payload?: { path?: ValidationIssue['path'], error?: unknown, message?: string }) => ValidationIssue
	readonly failure: (issue: T['issueCode'] | ValidationIssue | ValidationIssue[]) => ExecutionChain<ValidationFailureResult>
	readonly createExecutionChain: () => ExecutionChain<void>
}

type AbstractSchemaConstructorPayload<T extends SchemaTypes> = Simplify<
	& (T['meta'] extends null ? unknown : { meta: T['meta'] })
	& { message?: SchemaMessage<T> }
>

abstract class AbstractBaseSchema<T extends SchemaTypes = any> extends NullProtoObj implements StandardSchemaV1<T['input'], T['output']> {
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

	get '~standard'(): StandardProps<T> { return this['~impl']()['~standard'] }
	get '~transformed'(): ((meta: T['meta']) => boolean) { return this['~impl']()['~transformed'] }
	get '~defaultMessage'(): SchemaMessage<T> { return this['~impl']()['~defaultMessage'] }
	get '~validate'(): (value: T['input'], utils: ValidationUtils<T>) => ExecutionChain<MaybePromise<ValidationResult<T['output']>>> { return this['~impl']()['~validate'] }

	validate(value: T['input']): T['result'] {
		const utils: ValidationUtils<T> = createObject<ValidationUtils<T>>({
			meta: this.meta,
			isTransformed: this.isTransformed,
			success: value => new ExecutionChain({ value }),
			issue: (code, { path, error, message } = {}) => ({
				code,
				message: message || resolveMessage({ code, value, path, error }, this['~defaultMessage'], this['~message']),
				path,
				error,
			}),
			failure: (issue) => {
				if (typeof issue === 'string')
					return new ExecutionChain({ issues: [utils.issue(issue)] })
				if (Array.isArray(issue))
					return new ExecutionChain({ issues: issue })
				return new ExecutionChain({ issues: [issue as any] })
			},
			createExecutionChain: () => new ExecutionChain<void>(void 0),
		})
		try {
			const result = utils.createExecutionChain().then(() => this['~validate'](value, utils)).value
			if (result instanceof Promise) {
				return result.catch(error => ({ issues: [utils.issue('UNKNOWN_ERROR', { error })] })) as T['result']
			}

			return result as T['result']
		}
		catch (error) {
			return { issues: [utils.issue('UNKNOWN_ERROR', { error })] } as T['result']
		}
	}

	get isTransformed() { return this['~transformed'](this.meta) }
}

type AsValSchema<T extends ValSchema | AbstractBaseSchema> = T extends ValSchema ? T : ValSchema<InferInput<T>, InferOutput<T>>

abstract class AbstractSchema<T extends SchemaTypes = any> extends AbstractBaseSchema<T> {
	pipe(): PipeSchema<[AsValSchema<this>]> {
		return new PipeSchema({ meta: { steps: [this as AsValSchema<this>] } })
	}
}

const standard = createObject<any>({
	version: 1,
	vendor: 'valchecker',
	validate(this: any, value: unknown) {
		return this.validate(value)
	},
})

const isNotTransformed = () => false

function implementSchemaClass<Schema extends AbstractBaseSchema>(
	Class: new (...args: any[]) => Schema,
	{
		isTransformed,
		defaultMessage,
		validate,
	}: {
		isTransformed?: Schema['~transformed']
		defaultMessage?: Schema['~defaultMessage']
		validate: Schema['~validate']
	},
) {
	const impl = createObject<any>({
		'~standard': standard,
		'~transformed': isTransformed || isNotTransformed,
		'~defaultMessage': defaultMessage,
		'~validate': validate,
	})
	Class.prototype['~impl'] = () => impl
}

interface _RawSchemaTypesParam {
	Async?: boolean
	Meta?: any
	Input?: any
	Output?: any
	IssueCode?: string
}

interface _ResolvedSchemaTypesParam {
	Async: boolean
	Meta: any
	Input: any
	Output: any
	IssueCode: string
	Result: MaybePromise<ValidationResult<any>>
}

type UnknownErrorIssueCode = 'UNKNOWN_ERROR'
interface ResolvedSchemaTypesParam<P extends _RawSchemaTypesParam> extends _ResolvedSchemaTypesParam {
	Async: Equal<P, any> extends true
		? boolean
		: P extends { Async: infer Async extends boolean } ? Async : false
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
		: (P extends { IssueCode: infer IssueCode extends string } ? IssueCode : never) | UnknownErrorIssueCode
	Result: [
		true extends this['Async']
			? Promise<ValidationResult<this['Output']>>
			: never,
		false extends this['Async']
			? ValidationResult<this['Output']>
			: never,
	][number]
}

interface _SchemaTypes<P extends _ResolvedSchemaTypesParam> extends StandardSchemaV1.Types<P['Input'], P['Output']> {
	readonly async: P['Async']
	readonly meta: P['Meta']
	readonly input: P['Input']
	readonly output: P['Output']
	readonly issueCode: P['IssueCode']
	readonly result: P['Result']
}

type SchemaTypes = _SchemaTypes<_ResolvedSchemaTypesParam>

type DefineSchemaTypes<P extends _RawSchemaTypesParam> = _SchemaTypes<ResolvedSchemaTypesParam<P>>

type InferAsync<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['async']
type InferMeta<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['meta']
type InferInput<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['input']
type InferOutput<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['output']
type InferIssueCode<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['issueCode']
type InferResult<Schema extends (ValSchema | AbstractBaseSchema)> = NonNullable<Schema['~standard']['types']>['result']

type PickedProps = '~standard' | 'meta' | 'isTransformed' | 'validate'
type ValSchema<Input = unknown, Output = unknown>
	= Pick<AbstractBaseSchema<{
		readonly async: false
		readonly meta: any
		readonly input: Input
		readonly output: Output
		readonly issueCode: any
		readonly result: ValidationResult<Output>
	}>, PickedProps>
	| Pick<AbstractBaseSchema<{
		readonly async: true
		readonly meta: any
		readonly input: Input
		readonly output: Output
		readonly issueCode: any
		readonly result: Promise<ValidationResult<Output>>
	}>, PickedProps>

function prependIssuePath(issue: ValidationIssue, path: PropertyKey[]): ValidationIssue {
	return {
		...issue,
		path: [...path, ...(issue.path || [])],
	}
}

function isSuccessResult<Output>(result: ValidationResult<Output>): result is ValidationSuccessResult<Output> {
	return 'value' in result
}

export type {
	DefineSchemaTypes,
	InferAsync,
	InferInput,
	InferIssueCode,
	InferMeta,
	InferOutput,
	InferResult,
	SchemaMessage,
	ValidationFailureResult,
	ValidationIssue,
	ValidationResult,
	ValidationSuccessResult,
	ValSchema,
}

export {
	AbstractBaseSchema,
	AbstractSchema,
	implementSchemaClass,
	isSuccessResult,
	prependIssuePath,
}
