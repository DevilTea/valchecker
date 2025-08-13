import type { StandardSchemaV1 } from '@standard-schema/spec'
import { createObject } from './utils'

export interface SchemaTypesDefinition {
	Meta?: any
	Input?: any
	Output?: any
}

type _MetaOf<D extends SchemaTypesDefinition> = D extends { Meta: infer Meta } ? Meta : null
type _InputOf<D extends SchemaTypesDefinition> = D extends { Input: infer Input } ? Input : unknown
type _OutputOf<D extends SchemaTypesDefinition> = D extends { Output: infer Output } ? Output : D extends { Input: infer Input } ? Input : unknown

export interface SchemaTypes<D extends SchemaTypesDefinition> extends StandardSchemaV1.Types<_InputOf<D>, _OutputOf<D>> {
	readonly meta: _MetaOf<D>
	readonly input: _InputOf<D>
	readonly output: _OutputOf<D>
}

export interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {}
export interface ExecutionFailureResult extends StandardSchemaV1.FailureResult {}
export type ExecutionResult<Output> = ExecutionSuccessResult<Output> | ExecutionFailureResult

interface StandardProps<D extends SchemaTypesDefinition> extends StandardSchemaV1.Props<_InputOf<D>, _OutputOf<D>> {
	readonly version: 1
	readonly vendor: 'valchecker'
	readonly validate: (value: unknown) => ExecutionResult<_OutputOf<D>> | Promise<ExecutionResult<_OutputOf<D>>>
	readonly types?: SchemaTypes<D> | undefined
}

const _standardProps = createObject<StandardProps<any>>({
	version: 1,
	vendor: 'valchecker',
	validate(this: any, value: unknown) {
		return this.execute(value)
	},
})

function emptyPrototype(obj: object) {
	Object.setPrototypeOf(obj, null)
}

export abstract class AbstractSchema<D extends SchemaTypesDefinition> implements StandardSchemaV1<_InputOf<D>, _OutputOf<D>> {
	constructor(public meta: _MetaOf<D>) {}

	get '~standard'(): StandardProps<D> {
		return _standardProps
	}

	'~execute'(value: _InputOf<D>, schema: this): ExecutionResult<_OutputOf<D>> | Promise<ExecutionResult<_OutputOf<D>>>
	'~execute'(_value: _InputOf<D>, _schema: this): ExecutionResult<_OutputOf<D>> | Promise<ExecutionResult<_OutputOf<D>>> {
		throw new Error('Method not implemented.')
	}

	execute(value: _InputOf<D>): ExecutionResult<_OutputOf<D>> | Promise<ExecutionResult<_OutputOf<D>>> {
		return this['~execute'](value, this)
	}
}
emptyPrototype(AbstractSchema.prototype)

export function implementExecuteFn<SchemaClass extends typeof AbstractSchema<any>>(
	Schema: SchemaClass,
	execute: InstanceType<SchemaClass>['~execute'],
) {
	Schema.prototype['~execute'] = execute
}

// class StringSchema extends AbstractSchema<{ Output: string }> {}

// implementExecuteFn(
// 	StringSchema,
// 	(value) => {
// 		if (typeof value === 'string') {
// 			return { value }
// 		}
// 		return {
// 			issues: [{ message: 'Value is not a string', path: [] }],
// 		} as ExecutionFailureResult
// 	},
// )
