import type * as t from 'type-fest'

// Types
export type {
	IsEqual,
	Merge,
	Simplify,
	UnionToIntersection,
} from 'type-fest'

export type AnyFn = (...args: any[]) => any

/**
 * Extracts the parameters and return type of overloads in a function type as a union of tuples. (Up to 5 overloads supported)
 */
export type OverloadParametersAndReturnType<T> = T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
	(...args: infer P4): infer R4
	(...args: infer P5): infer R5
} ? [P1, R1] | [P2, R2] | [P3, R3] | [P4, R4] | [P5, R5] : T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
	(...args: infer P4): infer R4
} ? [P1, R1] | [P2, R2] | [P3, R3] | [P4, R4] : T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
} ? [P1, R1] | [P2, R2] | [P3, R3] : T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
} ? [P1, R1] | [P2, R2] : never

export type OverloadFn<F extends AnyFn[]> = t.UnionToIntersection<t.TupleToUnion<F>>

export type Optional<T> = T | undefined

export type IsAllPropsOptional<T> = {
	[P in keyof T]-?: undefined extends T[P] ? true : false
}[keyof T] extends true ? true : false

export type MaybePromise<T> = T | Promise<T>

export type IsPromise<T> = T extends Promise<any> ? true : Promise<any> extends T ? boolean : false

export type ValueHasProperty<K extends PropertyKey, V = unknown> = Record<K, V>

export type ValueHasLength = ValueHasProperty<'length', number>

export type ValueHasMethod<MethodName extends PropertyKey, Return = any> = ValueHasProperty<MethodName, (...args: any[]) => Return>

// Utils
/* @__NO_SIDE_EFFECTS__ */
export const NullProtoObj = (() => {
	const constructor = (function () { }) as unknown as new () => any
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
