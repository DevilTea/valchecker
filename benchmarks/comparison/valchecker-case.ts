/**
 * Valchecker case for typescript-runtime-type-benchmarks
 *
 * This file can be used with the typescript-runtime-type-benchmarks project
 * to compare valchecker with other validation libraries.
 *
 * Usage:
 * 1. Clone https://github.com/moltar/typescript-runtime-type-benchmarks
 * 2. Copy this file to the cases/ directory as valchecker.ts
 * 3. Add "valchecker": "^0.0.18" to package.json dependencies
 * 4. Run npm install
 * 5. Run npm start
 */

import { boolean, createValchecker, number, object, string } from 'valchecker'
import { createCase } from '../benchmarks'

const v = createValchecker({
	steps: [object, string, number, boolean],
})

createCase('valchecker', 'parseSafe', () => {
	const dataType = v.object({
		number: v.number(),
		negNumber: v.number(),
		maxNumber: v.number(),
		string: v.string(),
		longString: v.string(),
		boolean: v.boolean(),
		deeplyNested: v.object({
			foo: v.string(),
			num: v.number(),
			bool: v.boolean(),
		}),
	})

	return (data) => {
		const result = dataType.execute(data)
		if (dataType.isSuccess(result)) {
			return result.value
		}
		throw new Error('Validation failed')
	}
})

createCase('valchecker', 'parseStrict', () => {
	const dataType = v.object({
		number: v.number(),
		negNumber: v.number(),
		maxNumber: v.number(),
		string: v.string(),
		longString: v.string(),
		boolean: v.boolean(),
		deeplyNested: v.object({
			foo: v.string(),
			num: v.number(),
			bool: v.boolean(),
		}),
	})

	return (data) => {
		const result = dataType.execute(data)
		if (dataType.isSuccess(result)) {
			return result.value
		}
		throw new Error('Validation failed')
	}
})

createCase('valchecker', 'assertLoose', () => {
	const dataType = v.object({
		number: v.number(),
		negNumber: v.number(),
		maxNumber: v.number(),
		string: v.string(),
		longString: v.string(),
		boolean: v.boolean(),
		deeplyNested: v.object({
			foo: v.string(),
			num: v.number(),
			bool: v.boolean(),
		}),
	})

	return (data) => {
		const result = dataType.execute(data)
		if (dataType.isFailure(result)) {
			throw new Error('Validation failed')
		}
		return true
	}
})

createCase('valchecker', 'assertStrict', () => {
	const dataType = v.object({
		number: v.number(),
		negNumber: v.number(),
		maxNumber: v.number(),
		string: v.string(),
		longString: v.string(),
		boolean: v.boolean(),
		deeplyNested: v.object({
			foo: v.string(),
			num: v.number(),
			bool: v.boolean(),
		}),
	})

	return (data) => {
		const result = dataType.execute(data)
		if (dataType.isFailure(result)) {
			throw new Error('Validation failed')
		}
		return true
	}
})
