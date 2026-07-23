/**
 * Advanced, semver-covered API for custom Valchecker step plugins.
 *
 * Runtime implementation helpers from `shared` are intentionally not exported,
 * except the step discovery marker below, which the `@valchecker/all-steps`
 * package must share by value to avoid a duplicated `Symbol.for` string drifting
 * into a silently empty collection.
 */
export * from './core'
export { runtimeExecutionStepDefMarker } from './shared'
export type {
	AnyFn,
	Class,
	IsEqual,
	IsExactlyAnyOrUnknown,
	IsPromise,
	MaybePromise,
	MaybePromiseLike,
	OverloadParametersAndReturnType,
	OverloadReturnType,
	Simplify,
	UnionToIntersection,
	ValueOf,
} from './shared'
export * from './steps'
