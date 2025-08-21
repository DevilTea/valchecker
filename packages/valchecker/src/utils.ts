export const NullProtoObj = (() => {
	const constructor = (function () {}) as unknown as new () => any
	constructor.prototype = Object.create(null)
	Object.freeze(constructor.prototype)
	return constructor
})()

export function createObject<T extends Record<any, any> = Record<any, any>>(obj?: T): T {
	const _obj = new NullProtoObj() as T
	obj && Object.assign(_obj, obj)
	return _obj
}

export function throwNotImplementedError(): never {
	throw new Error('Method not implemented.')
}

export type Simplify<T> = { [P in keyof T]: T[P] } & {}

export type Optional<T> = T | undefined

export type IsAllPropsOptional<T> = {
	[P in keyof T]-?: undefined extends T[P] ? true : false
}[keyof T] extends true ? true : false

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

export type MaybePromise<T> = T | Promise<T>

export class ExecutionChain<T = undefined, E = unknown> implements PromiseLike<Awaited<T>> {
	private readonly isAsync: boolean
	private readonly _value: T | undefined
	private readonly _error: E | undefined

	constructor(value?: T, error?: E) {
		if (value instanceof ExecutionChain) {
			this._value = value._value
			this._error = value._error
			this.isAsync = value.isAsync
		}
		else {
			this._value = value
			this._error = error
			this.isAsync = this.isPromiseLike(value) || this.isPromiseLike(error)
		}
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

	then<TResult1 = Awaited<T>, TResult2 = never>(
		onfulfilled?: ((value: Awaited<T>) => TResult1 | PromiseLike<TResult1>) | null | undefined,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
	): ExecutionChain<TResult1 | TResult2> {
		if (!onfulfilled && !onrejected) {
			return this as any
		}

		if (this.isAsync) {
			return new ExecutionChain(
				Promise.resolve(this._value!)
					.then(
						onfulfilled,
						(error) => {
							if (onrejected) {
								return onrejected(error)
							}
							throw error
						},
					) as TResult1 | TResult2,
			)
		}

		try {
			if (this._error) {
				if (onrejected) {
					return new ExecutionChain(onrejected(this._error) as TResult2)
				}
				return new ExecutionChain(void 0, this._error) as ExecutionChain<TResult1>
			}
		}
		catch (error) {
			return new ExecutionChain(void 0, error) as ExecutionChain<TResult1>
		}

		try {
			if (!onfulfilled) {
				return this as any
			}

			const result = onfulfilled(this._value as Awaited<T>)

			return new ExecutionChain(result as TResult1)
		}
		catch (error) {
			return new ExecutionChain(void 0, error) as ExecutionChain<TResult1>
		}
	}

	get value() {
		if (this._error) {
			if (this.isAsync)
				return Promise.reject(this._error)
			else
				throw this._error
		}
		return this._value
	}
}
