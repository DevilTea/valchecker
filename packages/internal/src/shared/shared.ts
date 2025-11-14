import type * as t from 'type-fest'

// Types
export type {
	Class,
	IsEqual,
	Simplify,
	UnionToIntersection,
	ValueOf,
} from 'type-fest'

export type IsExactlyAnyOrUnknown<T> = t.IsAny<T> extends true
	? true
	: t.IsUnknown<T> extends true
		? true
		: false

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
} ? [P1, R1] | [P2, R2] : T extends {
	(...args: infer P1): infer R1
} ? [P1, R1] : never

export type MaybePromise<T> = T | Promise<T>

export type IsPromise<T> = T extends Promise<any> ? true : Promise<any> extends T ? boolean : false

/**
 * Extracts the return type of overloads in a function type as a union. (Up to 5 overloads supported)
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
} ? R1 | R2 : T extends {
	(...args: any[]): infer R1
} ? R1 : never

// Utils
/* @__NO_SIDE_EFFECTS__ */
export function returnTrue() {
	return true
}

/* @__NO_SIDE_EFFECTS__ */
export class Pipe<I = unknown, O = I> {
	list: ((x: any) => any)[] = []

	add<NewO>(fn: (x: O) => MaybePromise<NewO>): Pipe<I, NewO> {
		this.list.push(fn)
		return this as any
	}

	exec(x: I): MaybePromise<O> {
		// Optimized execution: Use for loop instead of reduce for better performance
		const fns = this.list
		const len = fns.length
		let result: any = x

		for (let i = 0; i < len; i++) {
			// Check if current result is a promise
			if (result instanceof Promise) {
				// Once we hit async, chain all remaining functions
				for (let j = i; j < len; j++) {
					result = result.then(fns[j])
				}
				return result
			}
			// Execute function synchronously
			result = fns[i](result)
		}
		return result
	}
}

/* @__NO_SIDE_EFFECTS__ */
export function noop() {}

/* @__NO_SIDE_EFFECTS__ */
export const runtimeExecutionStepDefMarker = Symbol.for('valchecker:runtimeExecutionStepDefMarker')
