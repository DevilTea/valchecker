// Types
export type AnyFn = (...args: any[]) => any

export type Simplify<T> = { [P in keyof T]: T[P] } & {}

export type Optional<T> = T | undefined

export type IsAllPropsOptional<T> = {
	[P in keyof T]-?: undefined extends T[P] ? true : false
}[keyof T] extends true ? true : false

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

export type MaybePromise<T> = T | Promise<T>

export type IsReturnPromise<Fn extends (...args: any[]) => any> = ReturnType<Fn> extends Promise<any>
	? true
	: Promise<any> extends ReturnType<Fn>
		? boolean
		: false

// Utils
export const NullProtoObj = (() => {
	const constructor = (function () {}) as unknown as new () => any
	constructor.prototype = Object.create(null)
	Object.freeze(constructor.prototype)
	return constructor
})()

export function createObject<T extends Record<any, any> = Record<any, any>>(obj?: T): T {
	const _obj = new NullProtoObj() as T
	if (obj) {
		// Exclude some properties that can cause prototype pollution
		// eslint-disable-next-line no-restricted-properties
		const { __proto__, constructor, prototype, ...rest } = obj as any
		Object.assign(_obj, rest)
	}
	return _obj
}

export function throwNotImplementedError(): never {
	throw new Error('Method not implemented.')
}

export function expectNever(value?: never): never {
	throw new Error(`Expected never, but got: ${value}`)
}

export function returnTrue() {
	return true
}

export function returnFalse() {
	return false
}

export class ExecutionChain<T> implements PromiseLike<T> {
	private readonly _data: [value: T | PromiseLike<T>, syncError: undefined] | [value: undefined, syncError: unknown]

	constructor(...params: [value: T | PromiseLike<T> | ExecutionChain<T>, syncError?: undefined] | [value: undefined, syncError: unknown]) {
		const [value, syncError] = params

		if (value instanceof ExecutionChain) {
			this._data = value._data
			return
		}

		if (syncError != null && this.isPromiseLike(value)) {
			throw new Error('ExecutionChain cannot have both an async value and a sync error.')
		}
		this._data = [value, syncError] as any
	}

	private isPromiseLike(value: any): value is PromiseLike<any> {
		return (
			value instanceof Promise
			|| (
				value
				&& !(value instanceof ExecutionChain)
				&& typeof value.then === 'function'
			)
		)
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
	): ExecutionChain<TResult1 | TResult2> {
		if (!onfulfilled && !onrejected) {
			return this as any
		}

		// 1. Async value
		if (this.isPromiseLike(this._data[0])) {
			return new ExecutionChain(this._data[0].then(onfulfilled, onrejected))
		}

		// 2. Sync error
		if (this._data[1] != null) {
			if (onrejected == null)
				return this as any

			try {
				const result = onrejected(this._data[1])
				return new ExecutionChain(result as TResult2)
			}
			catch (error) {
				return new ExecutionChain<TResult1>(void 0, error)
			}
		}

		// 3. Sync value
		if (onfulfilled == null)
			return this as any

		try {
			return new ExecutionChain(onfulfilled(this._data[0] as T) as TResult1)
		}
		catch (error) {
			return new ExecutionChain<TResult1>(void 0, error)
		}
	}

	get value(): MaybePromise<T> {
		// 1. Async value
		if (this.isPromiseLike(this._data[0])) {
			return Promise.resolve(this._data[0])
		}
		// 2. Sync error
		if (this._data[1] != null) {
			throw this._data[1]
		}
		// 3. Sync value
		return this._data[0] as T
	}
}

export function createExecutionChain(): ExecutionChain<void>
export function createExecutionChain<T>(value: T): ExecutionChain<T>
export function createExecutionChain(value?: any): ExecutionChain<any> {
	return new ExecutionChain(value, void 0)
}
