/**
 * Advanced, semver-covered API for custom Valchecker step plugins.
 *
 * Runtime implementation helpers from `shared` are intentionally not exported,
 * except the versioned step-discovery protocol marker below, which
 * `@valchecker/all-steps` must share by value with compatible physical copies.
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
