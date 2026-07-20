import { describe, expect, it } from 'vitest'
import {
	array,
	check,
	fallback,
	generic,
	intersection,
	isLengthAtLeast,
	literal,
	looseObject,
	map,
	number,
	object,
	set,
	strictObject,
	string,
	toAsync,
	toTrimmed,
	transform,
	union,
	unknown,
	use,
	variant,
} from '../steps'
import { createValchecker } from './core'

const v = createValchecker({
	steps: [
		array,
		check,
		fallback,
		generic,
		intersection,
		isLengthAtLeast,
		literal,
		looseObject,
		map,
		number,
		object,
		set,
		strictObject,
		string,
		toAsync,
		toTrimmed,
		transform,
		union,
		unknown,
		use,
		variant,
	],
})

describe('runtime operation-mode metadata', () => {
	it('keeps ordinary and fully synchronous structural schemas synchronous', () => {
		expect(v['~core'].operationMode).toBe('sync')
		expect(v.string()['~core'].operationMode).toBe('sync')
		expect(v.string().isLengthAtLeast(1).toTrimmed()['~core'].operationMode).toBe('sync')
		expect(v.array(v.string())['~core'].operationMode).toBe('sync')
		expect(v.object({ value: v.string() })['~core'].operationMode).toBe('sync')
		expect(v.looseObject({ value: v.string() })['~core'].operationMode).toBe('sync')
		expect(v.strictObject({ value: v.string() })['~core'].operationMode).toBe('sync')
		expect(v.map({ key: v.string(), value: v.number() })['~core'].operationMode).toBe('sync')
		expect(v.set(v.string())['~core'].operationMode).toBe('sync')
		expect(v.union([v.string(), v.number()])['~core'].operationMode).toBe('sync')
		expect(v.intersection([v.string(), v.string()])['~core'].operationMode).toBe('sync')
		expect(v.variant({
			discriminator: 'type',
			variants: {
				text: v.object({ type: v.literal('text'), value: v.string() }),
			},
		})['~core'].operationMode).toBe('sync')
	})

	it('conservatively propagates callback and conditional child asynchrony', () => {
		const callback = v.string().transform(value => value.toUpperCase())
		const asynchronous = v.string().transform(async value => value.toUpperCase())

		expect(callback['~core'].operationMode).toBe('maybe-async')
		expect(v.string().check(value => value.length > 0)['~core'].operationMode).toBe('maybe-async')
		expect(v.string().fallback(() => 'fallback')['~core'].operationMode).toBe('maybe-async')
		expect(v.array(asynchronous)['~core'].operationMode).toBe('maybe-async')
		expect(v.object({ value: asynchronous })['~core'].operationMode).toBe('maybe-async')
		expect(v.looseObject({ value: asynchronous })['~core'].operationMode).toBe('maybe-async')
		expect(v.strictObject({ value: asynchronous })['~core'].operationMode).toBe('maybe-async')
		expect(v.map({ key: v.string(), value: asynchronous })['~core'].operationMode).toBe('maybe-async')
		expect(v.set(asynchronous)['~core'].operationMode).toBe('maybe-async')
		expect(v.union([v.string(), asynchronous])['~core'].operationMode).toBe('maybe-async')
		expect(v.intersection([v.string(), asynchronous])['~core'].operationMode).toBe('maybe-async')
		expect(v.variant({
			discriminator: 'type',
			variants: {
				text: v.object({ type: v.literal('text'), value: asynchronous }),
			},
		})['~core'].operationMode).toBe('maybe-async')
		expect(v.unknown().use(asynchronous)['~core'].operationMode).toBe('maybe-async')
	})

	it('preserves unconditional async mode through later conditional steps', () => {
		const schema = v.string().toAsync()

		expect(schema['~core'].operationMode).toBe('async')
		expect(schema.check(value => value.length > 0)['~core'].operationMode).toBe('async')
		expect(schema.transform(value => value.toUpperCase())['~core'].operationMode).toBe('async')
	})

	it('propagates direct and factory generic composition conservatively', () => {
		const genericSchema = v.unknown() as any
		const synchronous = v.string()
		const legacySchema = {
			'~core': { runtimeSteps: synchronous['~core'].runtimeSteps },
		}

		expect(genericSchema.generic(synchronous)['~core'].operationMode).toBe('sync')
		expect(genericSchema.generic(v.string().toAsync())['~core'].operationMode).toBe('async')
		expect(genericSchema.generic(() => v.string())['~core'].operationMode).toBe('maybe-async')
		expect(genericSchema.generic(legacySchema)['~core'].operationMode).toBe('maybe-async')
	})
})
