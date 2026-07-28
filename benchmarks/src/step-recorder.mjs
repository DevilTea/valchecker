/**
 * A Valchecker instance that records which step methods are called on it.
 *
 * The Valchecker adapter takes its instance from `VALCHECKER_DIST_URL`, so pointing
 * that at this module puts a recorder between the adapter and the real build without
 * the adapter knowing. `step-audit.mjs` then drives every `build()` and compares what
 * was called against what the scenarios declare in `steps`.
 *
 * Two properties make the recording trustworthy:
 *
 * - **The library never sees a proxy.** Every argument is unwrapped back to the real
 *   schema before the call is forwarded, so field objects, union branch arrays, and
 *   nested schemas reach the implementation exactly as they would without this module.
 *   A proxy leaking into the library would risk changing what is built, and an audit
 *   that changes its subject measures nothing.
 * - **The step names come from the build itself**, as the own property names of the
 *   prototype every schema of the instance shares. That is the registered method set by
 *   construction, so the audit cannot go stale against a renamed or added step, and
 *   non-step members (`execute`, `~standard`, `isSuccess`) are passed through untouched
 *   rather than reported as steps.
 */
import process from 'node:process'

const realUrl = process.env.VALCHECKER_AUDIT_TARGET
	|| new URL('../../packages/valchecker/dist/index.mjs', import.meta.url).href

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const { v: real } = await import(realUrl)

const stepNames = new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(real)))
const targets = new WeakMap()

/** Method names observed since the last `resetRecording()`, in call order. */
const observed = new Set()

export function resetRecording() {
	observed.clear()
}

export function recordedSteps() {
	return [...observed]
}

/** Every public step method the loaded build registers. */
export function registeredStepNames() {
	return [...stepNames]
}

function unwrap(value) {
	if (value == null || (typeof value !== 'object' && typeof value !== 'function'))
		return value
	const target = targets.get(value)
	if (target !== undefined)
		return target
	if (Array.isArray(value))
		return value.map(unwrap)
	// A callback can return a schema — `use`, `fallback`, and `transform` all take one —
	// and that schema would be a proxy built inside the callback. Unwrapping the return
	// value keeps the "no proxy reaches the library" property for the deferred case too.
	if (typeof value === 'function')
		return (...args) => unwrap(value(...args))
	if (Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(Object.entries(value)
			.map(([key, item]) => [key, unwrap(item)]))
	}
	return value
}

function wrap(schema) {
	if (schema == null || typeof schema !== 'object')
		return schema
	const proxy = new Proxy(schema, {
		get(target, property) {
			const value = Reflect.get(target, property)
			if (typeof property !== 'string' || !stepNames.has(property) || typeof value !== 'function')
				return value
			return (...args) => {
				observed.add(property)
				return wrap(value.apply(target, args.map(unwrap)))
			}
		},
	})
	targets.set(proxy, schema)
	return proxy
}

export const v = wrap(real)
