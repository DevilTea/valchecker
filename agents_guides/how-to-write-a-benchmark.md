# How to Write a Benchmark

This guide explains how to create performance benchmarks for Valchecker steps using Vitest's benchmarking features. Every step should have a corresponding `.bench.ts` file to ensure performance is monitored and regressions are caught.

## Benchmark File Structure

Benchmark files should be co-located with the source file and test file:

```
src/steps/example/
├── example.ts        # Implementation
├── example.test.ts   # Unit tests
└── example.bench.ts  # Benchmarks
```

### Standard Template

Every benchmark file should follow this structure:

```typescript
/**
 * Benchmark plan for <step-name>:
 * - Operations benchmarked: <step-name> validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, <stepName> } from '../..'

// Create a reusable valchecker instance
const v = createValchecker({ steps: [<stepName>] })

describe('<stepName> benchmarks', () => {
	// 1. Valid Inputs
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.<stepName>().execute(<small-input>)
		})

		bench('valid input - large', () => {
			v.<stepName>().execute(<large-input>)
		})
	})

	// 2. Invalid Inputs
	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.<stepName>().execute(<invalid-input>)
		})
	})

	// 3. Baselines (Optional but recommended)
	describe('baselines', () => {
		bench('native check', () => {
			// Native JS equivalent for comparison
			// e.g., typeof value === 'string'
		})
	})
})
```

## Best Practices

### 1. Prepare Data Outside Benchmarks

Avoid creating test data inside the benchmark function to measure only the validation performance.

**Bad:**
```typescript
bench('valid input', () => {
	const data = Array.from({ length: 1000 }, (_, i) => i) // Overhead included
	v.array().execute(data)
})
```

**Good:**
```typescript
const data = Array.from({ length: 1000 }, (_, i) => i)

bench('valid input', () => {
	v.array().execute(data)
})
```

### 2. Cover Key Scenarios

- **Small Valid Input**: Measures the base overhead of the step.
- **Large Valid Input**: Measures how the step scales with data size (O(n) complexity).
- **Invalid Input**: Measures how quickly the step fails (fail-fast behavior).

### 3. Include Baselines

Where possible, include a native JavaScript baseline to understand the overhead of the library.

```typescript
describe('baselines', () => {
	bench('native typeof check', () => {
		typeof 'hello' === 'string'
	})
})
```

### 4. Benchmark Chaining (If Applicable)

If the step is commonly used in a chain, benchmark it in that context.

```typescript
describe('chaining', () => {
	bench('chained with min', () => {
		v.string().min(5).execute('hello world')
	})
})
```

## Running Benchmarks

To run benchmarks locally:

```bash
pnpm bench
```

To run benchmarks in watch mode during development:

```bash
pnpm bench:watch
```
