# How to Test a Step

This document provides specific patterns and examples for testing a **step plugin**. It builds upon the general principles defined in [**How to Write a Test**](./how-to-write-a-test.md) and assumes you have already read it.

## Overview

Testing a step involves validating its logic within the `valchecker` execution context. The goal is to ensure the step correctly processes the input value, produces the right output, and generates the correct issues upon failure.

## Test File Setup

To test a step, create a `valchecker` instance and initialize it with the step under test, along with any other steps it depends on (e.g., a `string` step being constrained by a `max` step).

```typescript
import { describe, expect, it } from 'vitest'
import { createValchecker, max, string } from '../..'

// Instance for testing the `max` step, which depends on `string`
const v = createValchecker({ steps: [max, string] })
```

**Important**: Import steps from the root (`'../..'`) to ensure you're testing the actual exports.

## Common Test Patterns for Steps

### Valid Inputs

Test scenarios where the input is expected to pass validation. Assert that the result is a success object containing the correct value using `toEqual`.

```typescript
it('should pass for a valid value', () => {
	const result = v.string().max(5).execute('hello')
	expect(result).toEqual({ value: 'hello' })
})
```

### Invalid Inputs

Test scenarios where the input is expected to fail. For initial type validators (like `string`, `number`, etc.), test **all** JavaScript primitive types:
- `string`
- `number`
- `boolean`
- `null`
- `undefined`
- `bigint`
- `symbol`
- `object` (plain objects)
- `array`

Assert that the result is a failure object with a correctly structured issue.

```typescript
describe('invalid inputs', () => {
	it('should fail for number', () => {
		const result = v.string().execute(123)
		expect(result).toEqual({
			issues: [{
				code: 'string:expected_string',
				payload: { value: 123 },
				message: 'Expected a string.',
			}],
		})
	})

	it('should fail for boolean', () => {
		const result = v.string().execute(true)
		expect(result).toEqual({
			issues: [{
				code: 'string:expected_string',
				payload: { value: true },
				message: 'Expected a string.',
			}],
		})
	})

	// ... test all other primitive types
})
```

For constraint steps (like `max`, `min`), test values that violate the constraint:

```typescript
it('should fail for a value exceeding the max', () => {
	const result = v.string().max(3).execute('hello')
	expect(result).toEqual({
		issues: [{
			code: 'max:expected_max',
			payload: { target: 'length', value: 'hello', max: 3 },
			message: 'Expected a maximum length of 3.',
		}],
	})
})
```

### Edge Cases

Test boundary conditions and special values:

```typescript
describe('edge cases', () => {
	it('should handle zero as max', () => {
		const result = v.number().max(0).execute(0)
		expect(result).toEqual({ value: 0 })
	})

	it('should handle negative numbers', () => {
		const result = v.number().max(-5).execute(-10)
		expect(result).toEqual({ value: -10 })
	})

	it('should handle empty strings', () => {
		const result = v.string().execute('')
		expect(result).toEqual({ value: '' })
	})

	it('should handle empty arrays', () => {
		const result = v.array(v.number()).execute([])
		expect(result).toEqual({ value: [] })
	})
})
```

### Custom Messages

If the step supports custom messages, add test cases to verify both string messages and function-based message handlers:

```typescript
describe('custom messages', () => {
	it('should use custom string message', () => {
		const result = v.string().max(3, 'Too long!').execute('hello')
		expect(result).toEqual({
			issues: [{
				code: 'max:expected_max',
				payload: { target: 'length', value: 'hello', max: 3 },
				message: 'Too long!',
			}],
		})
	})

	it('should use custom message handler', () => {
		const result = v.number().max(10, () => 'Custom error message').execute(15)
		expect(result).toEqual({
			issues: [{
				code: 'max:expected_max',
				payload: { target: 'number', value: 15, max: 10 },
				message: 'Custom error message',
			}],
		})
	})
})
```

### Async Operations

For steps that handle asynchronous logic (e.g., `transform`, `check` with an async function), use `async/await` and test both successful resolution and error handling.

```typescript
describe('async operations', () => {
	it('should handle async transformation', async () => {
		const result = await v.string()
			.transform(async x => x.toUpperCase())
			.execute('hello')
		expect(result).toEqual({ value: 'HELLO' })
	})

	it('should handle async errors', async () => {
		const result = await v.transform(async () => {
			throw new Error('fail')
		}).execute(5)
		expect(result).toEqual({
			issues: [{
				code: 'transform:failed',
				payload: { value: 5, error: expect.any(Error) },
				message: 'Transform failed',
			}],
		})
	})
})
```

### Chaining

Test that the step chains correctly with other steps, ensuring the validation context is passed and updated as expected.

```typescript
describe('chaining', () => {
	it('should chain successfully', () => {
		const result = v.string().min(3).max(10).execute('hello')
		expect(result).toEqual({ value: 'hello' })
	})

	it('should fail at first step in chain', () => {
		// `max` is chained after `string`, which fails first.
		const result = v.string().max(5).execute(123)
		expect(result).toEqual({
			issues: [{
				code: 'string:expected_string',
				payload: { value: 123 },
				message: 'Expected a string.',
			}],
		})
	})

	it('should fail at second step in chain', () => {
		const result = v.string().min(5).execute('hi')
		expect(result).toEqual({
			issues: [{
				code: 'min:expected_min',
				payload: { target: 'length', value: 'hi', min: 5 },
				message: 'Expected a minimum length of 5.',
			}],
		])
	})
})
```

## Additional Patterns

### Testing Method Overloads

For steps with multiple overloads (e.g., `max` for numbers, bigints, and lengths), test each overload:

```typescript
describe('overloads', () => {
	it('should work with number overload', () => {
		const result = v.number().max(10).execute(5)
		expect(result).toEqual({ value: 5 })
	})

	it('should work with bigint overload', () => {
		const result = v.bigint().max(10n).execute(5n)
		expect(result).toEqual({ value: 5n })
	})

	it('should work with length overload', () => {
		const result = v.string().max(5).execute('hello')
		expect(result).toEqual({ value: 'hello' })
	})
})
```

### Testing Nested Structures

For steps that work with nested structures (e.g., `object`, `array`), test nested validation and issue paths:

```typescript
it('should handle nested validation', () => {
	const result = v.object({
		user: v.object({
			name: v.string(),
		}),
	}).execute({
		user: {
			name: 123,
		},
	})
	expect(result).toEqual({
		issues: [{
			code: 'string:expected_string',
			path: ['user', 'name'],
			payload: { value: 123 },
			message: 'Expected a string.',
		}],
	})
})
```

### Testing Optional Properties

For steps that support optional properties (e.g., `object` with optional fields), test both presence and absence:

```typescript
it('should handle optional property present', () => {
	const result = v.object({
		name: v.string(),
		age: [v.number()],
	}).execute({
		name: 'John',
		age: 30,
	})
	expect(result).toEqual({
		value: {
			name: 'John',
			age: 30,
		},
	})
})

it('should handle optional property missing', () => {
	const result = v.object({
		name: v.string(),
		age: [v.number()],
	}).execute({
		name: 'John',
	})
	expect(result).toEqual({
		value: {
			name: 'John',
			age: undefined,
		},
	})
})
```
## Next Steps

After writing comprehensive tests for your step:

1. **Create performance benchmarks** following [How to Create a Benchmark](./how-to-create-benchmark.md)
2. **Run verification**:
   ```bash
   pnpm lint      # Ensure code style compliance
   pnpm typecheck # Verify TypeScript types
   pnpm test      # Ensure all tests pass (including your new tests)
   pnpm bench     # Measure performance with benchmarks
   ```
3. **Review test coverage** to ensure all edge cases are covered
4. **Document any special testing considerations** in the step's JSDoc

## Related Guides

- [How to Define a Step](./how-to-define-create-step.md) - Step creation guide
- [How to Create a Benchmark](./how-to-create-benchmark.md) - Benchmark creation guide
- [How to Write a Test](./how-to-write-a-test.md) - General testing principles
- [How to Proofread a Test for a Step](./how-to-proofread-a-test-for-step.md) - Test review guide
