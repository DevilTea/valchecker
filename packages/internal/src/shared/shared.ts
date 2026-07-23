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
 * Extracts the parameters and return type of overloads in a function type as a union of tuples. (Up to 8 overloads supported)
 *
 * WARNING: this ladder matches the widest arity that fits. A function with MORE
 * overloads than the highest branch does not fail to compile — TypeScript
 * structurally matches the 8-signature branch and SILENTLY DROPS the first
 * overload(s) that exceed the limit, so the impl-side params/return typing binds
 * to the wrong variant with zero diagnostics. Keep the highest step variant count
 * strictly below this limit; see `shared.types.test.ts` for the sentinel guard.
 */
export type OverloadParametersAndReturnType<T> = T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
	(...args: infer P4): infer R4
	(...args: infer P5): infer R5
	(...args: infer P6): infer R6
	(...args: infer P7): infer R7
	(...args: infer P8): infer R8
} ? [P1, R1] | [P2, R2] | [P3, R3] | [P4, R4] | [P5, R5] | [P6, R6] | [P7, R7] | [P8, R8] : T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
	(...args: infer P4): infer R4
	(...args: infer P5): infer R5
	(...args: infer P6): infer R6
	(...args: infer P7): infer R7
} ? [P1, R1] | [P2, R2] | [P3, R3] | [P4, R4] | [P5, R5] | [P6, R6] | [P7, R7] : T extends {
	(...args: infer P1): infer R1
	(...args: infer P2): infer R2
	(...args: infer P3): infer R3
	(...args: infer P4): infer R4
	(...args: infer P5): infer R5
	(...args: infer P6): infer R6
} ? [P1, R1] | [P2, R2] | [P3, R3] | [P4, R4] | [P5, R5] | [P6, R6] : T extends {
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
export type MaybePromiseLike<T> = T | PromiseLike<T>

export type IsPromise<T> = T extends PromiseLike<any>
	? true
	: PromiseLike<any> extends T
		? boolean
		: false

/**
 * Extracts the return type of overloads in a function type as a union. (Up to 8 overloads supported)
 *
 * WARNING: same silent-drop failure mode as `OverloadParametersAndReturnType`.
 * A function with more overloads than the highest branch compiles cleanly while
 * DROPPING the first overload(s) beyond the limit. Keep the highest step variant
 * count strictly below this limit; see `shared.types.test.ts` for the sentinel.
 */
export type OverloadReturnType<T> = T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
	(...args: any[]): infer R4
	(...args: any[]): infer R5
	(...args: any[]): infer R6
	(...args: any[]): infer R7
	(...args: any[]): infer R8
} ? R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 : T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
	(...args: any[]): infer R4
	(...args: any[]): infer R5
	(...args: any[]): infer R6
	(...args: any[]): infer R7
} ? R1 | R2 | R3 | R4 | R5 | R6 | R7 : T extends {
	(...args: any[]): infer R1
	(...args: any[]): infer R2
	(...args: any[]): infer R3
	(...args: any[]): infer R4
	(...args: any[]): infer R5
	(...args: any[]): infer R6
} ? R1 | R2 | R3 | R4 | R5 | R6 : T extends {
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
export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
	return (typeof value === 'object' || typeof value === 'function')
		&& value !== null
		&& typeof (value as { then?: unknown }).then === 'function'
}

/* @__NO_SIDE_EFFECTS__ */
export function returnTrue() {
	return true
}

/* @__NO_SIDE_EFFECTS__ */
export function noop() {}

/* @__NO_SIDE_EFFECTS__ */
export const runtimeExecutionStepDefMarker = Symbol.for('valchecker:runtimeExecutionStepDefMarker')
