/**
 * A Valchecker instance that records which step methods are called on it and can
 * rebuild the same public instance with one registered step omitted.
 *
 * `step-audit.mjs` uses the direct recording first, then omission probes every
 * other registered method. If removing a method makes an otherwise identical
 * adapter build fail, that method is a real indirect construction dependency
 * (for example `union(['px'])` reaches the registered `literal` shorthand provider
 * through the core registry without calling `v.literal()` directly).
 *
 * The adapter imports one stable `v` proxy. Its active target can therefore move
 * between the full instance and an omission instance without re-importing the
 * adapter. Schemas returned by a step call wrap the concrete schema that created
 * them; the library still never receives a proxy as a schema argument.
 */
import process from 'node:process'

const realUrl = process.env.VALCHECKER_AUDIT_TARGET
	|| new URL('../../packages/valchecker/dist/index.mjs', import.meta.url).href

// eslint-disable-next-line antfu/no-top-level-await -- benchmark audit entry module loads the built package once
const realModule = await import(realUrl)
const { allSteps, createValchecker, v: full } = realModule

if (typeof createValchecker !== 'function' || !Array.isArray(allSteps))
	throw new TypeError('The Valchecker audit target must export createValchecker(), allSteps, and v.')

const stepNames = new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(full)))
const pluginByStep = new Map()
for (const plugin of allSteps) {
	const names = Reflect.ownKeys(plugin)
		.filter(key => typeof key === 'string' && stepNames.has(key))
	if (names.length !== 1) {
		throw new TypeError(
			`Exact omission audit requires one public step method per built-in plugin; found ${names.length}: ${names.join(', ') || '(none)'}.`,
		)
	}
	pluginByStep.set(names[0], plugin)
}
for (const step of stepNames) {
	if (!pluginByStep.has(step))
		throw new TypeError(`The allSteps export has no plugin owning registered step '${step}'.`)
}

const targets = new WeakMap()
const omittedInstances = new Map()
let active = full

/** Method names observed since the last `resetRecording()`, in call order. */
const observed = new Set()

export function resetRecording() {
	observed.clear()
}

export function recordedSteps() {
	return [...observed]
}

/** Every public step method the loaded full build registers. */
export function registeredStepNames() {
	return [...stepNames]
}

/** Restore the instance containing the complete published step set. */
export function restoreAuditStepSet() {
	active = full
}

/**
 * Switch the stable exported `v` proxy to an otherwise-identical instance with
 * exactly one published step plugin omitted. Instances are cached because the
 * audit probes the same omission across many build keys.
 */
export function omitAuditStep(step) {
	const omittedPlugin = pluginByStep.get(step)
	if (omittedPlugin === undefined)
		throw new TypeError(`Cannot omit unknown Valchecker step '${step}'.`)
	let instance = omittedInstances.get(step)
	if (instance === undefined) {
		instance = createValchecker({ steps: allSteps.filter(plugin => plugin !== omittedPlugin) })
		omittedInstances.set(step, instance)
	}
	active = instance
}

function unwrap(value) {
	if (value == null || (typeof value !== 'object' && typeof value !== 'function'))
		return value
	const target = targets.get(value)
	if (target !== undefined)
		return target
	if (Array.isArray(value))
		return value.map(unwrap)
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

// Stable root identity for the adapter. Unlike a schema proxy, the target of this
// proxy is deliberately dynamic so omission probes can swap the registered step set.
export const v = new Proxy({}, {
	get(_target, property) {
		const value = Reflect.get(active, property)
		if (typeof property !== 'string' || !stepNames.has(property) || typeof value !== 'function')
			return value
		return (...args) => {
			observed.add(property)
			return wrap(value.apply(active, args.map(unwrap)))
		}
	},
})
