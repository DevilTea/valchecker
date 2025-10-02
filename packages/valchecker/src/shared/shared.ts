// Types
export type {
	IsEqual,
	Merge,
	Simplify,
	UnionToIntersection,
} from 'type-fest'

export type AnyFn = (...args: any[]) => any

/**
 * Extracts the parameter types from all overloads of a function type. (Up to 5 overloads supported)
 */
export type OverloadParameters<T> = T extends {
	(...args: infer P1): any
	(...args: infer P2): any
	(...args: infer P3): any
	(...args: infer P4): any
	(...args: infer P5): any
} ? P1 | P2 | P3 | P4 | P5 : T extends {
	(...args: infer P1): any
	(...args: infer P2): any
	(...args: infer P3): any
	(...args: infer P4): any
} ? P1 | P2 | P3 | P4 : T extends {
	(...args: infer P1): any
	(...args: infer P2): any
	(...args: infer P3): any
} ? P1 | P2 | P3 : T extends {
	(...args: infer P1): any
	(...args: infer P2): any
} ? P1 | P2 : never

/**
 * Extracts the return types from all overloads of a function type. (Up to 5 overloads supported)
 */
export type OverloadReturnType<T> = T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
	(...args: any[]): infer R4
	(...args: any[]): infer R5
} ? R1 | R2 | R3 | R4 | R5 : T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
	(...args: any[]): infer R4
} ? R1 | R2 | R3 | R4 : T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
} ? R1 | R2 | R3 : T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
} ? R1 | R2 : never

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
