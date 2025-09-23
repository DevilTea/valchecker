// Types
export type AnyFn = (...args: any[]) => any

export type Simplify<T> = { [P in keyof T]: T[P] } & {}

export type Optional<T> = T | undefined

export type IsAllPropsOptional<T> = {
	[P in keyof T]-?: undefined extends T[P] ? true : false
}[keyof T] extends true ? true : false

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

export type MaybePromise<T> = T | Promise<T>

export type IsPromise<T> = T extends Promise<any> ? true : Promise<any> extends T ? boolean : false

export type ValueHasProperty<K extends PropertyKey, V = unknown> = Record<K, V>

export type ValueHasLength = ValueHasProperty<'length', number>

export type ValueHasMethod<MethodName extends PropertyKey, Return = any> = ValueHasProperty<MethodName, (...args: any[]) => Return>

// Utils
/* @__NO_SIDE_EFFECTS__ */
export const NullProtoObj = (() => {
	const constructor = (function () {}) as unknown as new () => any
	constructor.prototype = Object.create(null)
	Object.freeze(constructor.prototype)
	return constructor
})()

/* @__NO_SIDE_EFFECTS__ */
export function createObject<T extends Record<any, any> = Record<any, any>>(obj?: T): T {
	const _obj = new NullProtoObj() as T
	if (obj) {
		Object.defineProperties(_obj, Object.getOwnPropertyDescriptors(obj))
	}
	return _obj
}

/* @__NO_SIDE_EFFECTS__ */
export function throwNotImplementedError(): never {
	throw new Error('Method not implemented.')
}

/* @__NO_SIDE_EFFECTS__ */
export function expectNever(value?: never): never {
	throw new Error(`Expected never, but got: ${value}`)
}

/* @__NO_SIDE_EFFECTS__ */
export function returnTrue() {
	return true
}

/* @__NO_SIDE_EFFECTS__ */
export function returnFalse() {
	return false
}
