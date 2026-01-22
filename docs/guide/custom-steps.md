# Custom Steps

This guide walks you through creating custom validation steps for Valchecker. Whether you need domain-specific validation, integration with external services, or specialized transformations, custom steps let you extend Valchecker while maintaining full type safety.

## Prerequisites

Before creating custom steps, familiarize yourself with:
- [Core Philosophy](/guide/core-philosophy) - Understanding the step pipeline
- TypeScript generics and conditional types (for type-safe steps)

## Quick Start: Using `check()`

For simple validations, use the built-in `check()` step:

```ts
const positiveNumber = v.number()
	.check(
		value => value > 0,
		'Value must be positive'
	)

// With custom issue data
const positiveNumber = v.number()
	.check(
		value => value > 0 || { message: 'Must be positive', value },
	)
```

This is sufficient for most one-off validations. Create a custom step plugin when you need:
- Reusable validation logic across multiple schemas
- Complex type transformations
- Configurable parameters
- Integration into the Valchecker step ecosystem

## Step Plugin Architecture

Every step plugin follows a three-layer pattern:

```
┌─────────────────────────────────────────┐
│  1. Meta (Type Metadata)                │
│     - Step name                         │
│     - Expected input type               │
│     - Issue definitions                 │
├─────────────────────────────────────────┤
│  2. PluginDef (TypeScript Interface)    │
│     - Method signature                  │
│     - JSDoc documentation               │
│     - Type conditions                   │
├─────────────────────────────────────────┤
│  3. Implementation (Runtime Logic)      │
│     - Validation/transformation logic   │
│     - Issue creation                    │
│     - Success/failure returns           │
└─────────────────────────────────────────┘
```

## Creating Your First Step

Let's create a `positive()` step that validates positive numbers.

### Step 1: Define Metadata

```ts
import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	MessageHandler,
	Next,
	TStepPluginDef,
} from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

// Define the step's type metadata
type Meta = DefineStepMethodMeta<{
	// Unique step name (used in method chaining)
	Name: 'positive'
	// What type this step expects (number)
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	// Issue type emitted on failure
	SelfIssue: ExecutionIssue<'positive:expected_positive', { value: number }>
}>
```

### Step 2: Define Plugin Interface

```ts
interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Validates that the number is positive (greater than zero).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * const v = createValchecker({ steps: [number, positive] })
	 * const schema = v.number().positive()
	 * schema.run(5)   // { isOk: true, value: 5 }
	 * schema.run(-1)  // { isOk: false, issues: [...] }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'positive:expected_positive'`: The value is not positive.
	 */
	positive: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}
```

### Step 3: Implement the Step

```ts
/* @__NO_SIDE_EFFECTS__ */
export const positive = implStepPlugin<PluginDef>({
	positive: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			if (value > 0) {
				return success(value)
			}

			return failure(
				createIssue({
					code: 'positive:expected_positive',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a positive number.',
				}),
			)
		})
	},
})
```

### Step 4: Use Your Step

```ts
import { createValchecker, number } from 'valchecker'
import { positive } from './positive'

const v = createValchecker({
	steps: [number, positive],
})

const schema = v.number()
	.positive()

schema.run(5) // { isOk: true, value: 5 }
schema.run(-1) // { isOk: false, issues: [{ code: 'positive:expected_positive', ... }] }
schema.run(0) // { isOk: false, issues: [{ code: 'positive:expected_positive', ... }] }
```

## Understanding the Implementation API

### Utils Object

The `utils` object provides helper functions:

| Function | Purpose |
|----------|---------|
| `addSuccessStep(fn)` | Register a validation function that runs on success |
| `addFailureStep(fn)` | Register a function that runs on failure (for recovery) |
| `success(value)` | Return a successful result with transformed value |
| `failure(issue)` | Return a failure result with an issue |
| `createIssue(opts)` | Create a structured issue object |

### Creating Issues

```ts
createIssue({
	code: 'step:issue_code', // Unique identifier
	payload: { /* data */ }, // Issue-specific data
	customMessage: message, // User-provided message override
	defaultMessage: 'Default message', // Fallback message
})
```

### Return Types

Steps must return one of:
- `success(value)` - Pass value to next step
- `failure(issue)` - Stop pipeline with issue
- `failure([issue1, issue2])` - Multiple issues

## Advanced Patterns

### Steps with Parameters

Create configurable steps by accepting parameters:

```ts
type Meta = DefineStepMethodMeta<{
	Name: 'divisibleBy'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'divisibleBy:not_divisible', { value: number, divisor: number }>
}>

interface PluginDef extends TStepPluginDef {
	divisibleBy: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (divisor: number, message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const divisibleBy = implStepPlugin<PluginDef>({
	divisibleBy: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [divisor, message],
	}) => {
		addSuccessStep((value) => {
			if (value % divisor === 0) {
				return success(value)
			}

			return failure(
				createIssue({
					code: 'divisibleBy:not_divisible',
					payload: { value, divisor },
					customMessage: message,
					defaultMessage: `Expected value to be divisible by ${divisor}.`,
				}),
			)
		})
	},
})

// Usage
v.number()
	.divisibleBy(3) // Must be divisible by 3
```

### Transform Steps

Steps that modify the output type:

```ts
type Meta = DefineStepMethodMeta<{
	Name: 'toSplitArray'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: never // Transform steps typically don't fail
}>

interface PluginDef extends TStepPluginDef {
	toSplitArray: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (separator?: string) => Next<
					{ output: string[] }, // Output type changes!
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toSplitArray = implStepPlugin<PluginDef>({
	toSplitArray: ({
		utils: { addSuccessStep, success },
		params: [separator = ','],
	}) => {
		addSuccessStep((value) => {
			return success(value.split(separator))
		})
	},
})

// Usage: string → string[]
const schema = v.string()
	.toSplitArray(',')
type Output = v.Infer<typeof schema> // string[]
```

### Async Steps

Steps can perform async operations:

```ts
/* @__NO_SIDE_EFFECTS__ */
export const uniqueEmail = implStepPlugin<PluginDef>({
	uniqueEmail: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(async (value) => {
			const exists = await db.users.findByEmail(value)

			if (!exists) {
				return success(value)
			}

			return failure(
				createIssue({
					code: 'uniqueEmail:already_exists',
					payload: { email: value },
					customMessage: message,
					defaultMessage: 'Email already exists.',
				}),
			)
		})
	},
})
```

### Recovery Steps (Fallback)

Use `addFailureStep` to catch and recover from failures:

```ts
/* @__NO_SIDE_EFFECTS__ */
export const orDefault = implStepPlugin<PluginDef>({
	orDefault: ({
		utils: { addFailureStep, success },
		params: [defaultValue],
	}) => {
		addFailureStep((_issues) => {
			// Catch any failure and return default value
			return success(defaultValue)
		})
	},
})
```

### Multi-Type Steps

Steps that work with multiple input types:

```ts
// See packages/internal/src/steps/min/min.ts for a complete example
// The `min` step works with number, bigint, and objects with length property

type Meta<T extends number | bigint | { length: number }> = DefineStepMethodMeta<{
	Name: 'min'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: ExecutionIssue<'min:expected_min', { value: T, min: T extends { length: number } ? number : T }>
}>
```

## File Structure Convention

When contributing steps to Valchecker, follow this structure:

```
packages/internal/src/steps/[step-name]/
├── [step-name].ts       # Implementation
├── [step-name].test.ts  # Tests (100% coverage required)
├── [step-name].bench.ts # Benchmarks
└── index.ts             # Re-export
```

Example `index.ts`:
```ts
export * from './positive'
```

## Testing Your Step

Create comprehensive tests with 100% coverage:

```ts
import { createValchecker, number } from 'valchecker'
import { describe, expect, it } from 'vitest'
import { positive } from './positive'

const v = createValchecker({ steps: [number, positive] })

describe('positive step', () => {
	describe('valid inputs', () => {
		it('should pass for positive numbers', () => {
			const schema = v.number()
				.positive()
			expect(schema.run(1))
				.toEqual({ isOk: true, value: 1 })
			expect(schema.run(0.5))
				.toEqual({ isOk: true, value: 0.5 })
			expect(schema.run(Number.MAX_VALUE))
				.toEqual({ isOk: true, value: Number.MAX_VALUE })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for zero', () => {
			const schema = v.number()
				.positive()
			const result = schema.run(0)
			expect(result.isOk)
				.toBe(false)
			if (!result.isOk) {
				expect(result.issues[0].code)
					.toBe('positive:expected_positive')
			}
		})

		it('should fail for negative numbers', () => {
			const schema = v.number()
				.positive()
			const result = schema.run(-5)
			expect(result.isOk)
				.toBe(false)
		})
	})

	describe('custom messages', () => {
		it('should use custom message when provided', () => {
			const schema = v.number()
				.positive('Must be positive!')
			const result = schema.run(-1)
			if (!result.isOk) {
				expect(result.issues[0].message)
					.toBe('Must be positive!')
			}
		})

		it('should support message function', () => {
			const schema = v.number()
				.positive(
					({ payload }) => `${payload.value} is not positive`
				)
			const result = schema.run(-5)
			if (!result.isOk) {
				expect(result.issues[0].message)
					.toBe('-5 is not positive')
			}
		})
	})
})
```

## Best Practices

### 1. Use `/* @__NO_SIDE_EFFECTS__ */`

Add this annotation before exports for tree-shaking:

```ts
/* @__NO_SIDE_EFFECTS__ */
export const myStep = implStepPlugin<PluginDef>({ /* ... */ })
```

### 2. Follow Issue Code Convention

Format: `[step-name]:[snake_case_description]`

```ts
// Good
'positive:expected_positive'
'email:invalid_format'
'uniqueUsername:already_taken'

// Bad
'POSITIVE_ERROR'
'invalidEmail'
```

### 3. Provide Helpful Default Messages

Include relevant values in messages:

```ts
defaultMessage: `Expected value to be at least ${min}, got ${value}.`
```

### 4. Document with JSDoc

Follow the three-section format:

```ts
/**
 * ### Description:
 * Brief explanation of what the step does.
 *
 * ---
 *
 * ### Example:
 * ```ts
 * // Code example
 * ```
 *
 * ---
 *
 * ### Issues:
 * - `'code:issue_name'`: When this issue occurs.
 */
```

### 5. Keep Steps Focused

Each step should do one thing well. Compose multiple steps for complex validation:

```ts
// Good: Focused steps
v.string()
	.toTrimmed()
	.min(1)
	.max(255)

// Bad: Monolithic step
v.trimmedWithMaxLength(255)
```

## Complete Example: Domain Validation

Here's a complete example of a domain-specific step:

```ts
// File: packages/internal/src/steps/isbn/isbn.ts

import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	MessageHandler,
	Next,
	TStepPluginDef,
} from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isbn'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isbn:invalid_isbn', { value: string, format: '10' | '13' | 'any' }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Validates that the string is a valid ISBN (International Standard Book Number).
	 * Supports ISBN-10, ISBN-13, or both formats.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * const v = createValchecker({ steps: [string, isbn] })
	 *
	 * v.string().isbn()        // Accept any valid ISBN
	 * v.string().isbn('10')    // Only ISBN-10
	 * v.string().isbn('13')    // Only ISBN-13
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isbn:invalid_isbn'`: The value is not a valid ISBN.
	 */
	isbn: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (format?: '10' | '13' | 'any', message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

function isValidISBN10(isbn: string): boolean {
	const cleaned = isbn.replace(/[-\s]/g, '')
	if (!/^\d{9}[\dX]$/.test(cleaned))
		return false

	let sum = 0
	for (let i = 0; i < 9; i++) {
		sum += Number.parseInt(cleaned[i], 10) * (10 - i)
	}
	const check = cleaned[9] === 'X' ? 10 : Number.parseInt(cleaned[9], 10)
	sum += check

	return sum % 11 === 0
}

function isValidISBN13(isbn: string): boolean {
	const cleaned = isbn.replace(/[-\s]/g, '')
	if (!/^\d{13}$/.test(cleaned))
		return false

	let sum = 0
	for (let i = 0; i < 12; i++) {
		sum += Number.parseInt(cleaned[i], 10) * (i % 2 === 0 ? 1 : 3)
	}
	const check = (10 - (sum % 10)) % 10

	return check === Number.parseInt(cleaned[12], 10)
}

/* @__NO_SIDE_EFFECTS__ */
export const isbn = implStepPlugin<PluginDef>({
	isbn: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [format = 'any', message],
	}) => {
		addSuccessStep((value) => {
			const isValid
				= format === '10'
					? isValidISBN10(value)
					: format === '13'
						? isValidISBN13(value)
						: isValidISBN10(value) || isValidISBN13(value)

			if (isValid) {
				return success(value)
			}

			return failure(
				createIssue({
					code: 'isbn:invalid_isbn',
					payload: { value, format },
					customMessage: message,
					defaultMessage: format === 'any'
						? 'Expected a valid ISBN-10 or ISBN-13.'
						: `Expected a valid ISBN-${format}.`,
				}),
			)
		})
	},
})
```

## Next Steps

- Browse existing steps in `packages/internal/src/steps/` for more patterns
- Check out the [API Reference](/api/overview) for all built-in steps
- Read the [Core Philosophy](/guide/core-philosophy) for deeper architectural understanding
