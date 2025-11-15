# How to Create a Benchmark for a Step

This guide explains how to create performance benchmarks for step plugins in the Valchecker framework. Benchmarks are essential for tracking performance improvements and regressions over time.

## Overview

Benchmarks measure the execution speed (operations per second) of steps under controlled conditions. They help identify performance bottlenecks and validate that optimizations actually improve performance.

## When to Create Benchmarks

You should create a benchmark:

- **For every new step**: When implementing a new step plugin
- **For performance-critical operations**: Steps that are likely to be used frequently
- **After optimization**: To measure and validate performance improvements
- **For comparison**: To compare different implementation approaches

## Benchmark File Location

Benchmarks are located in the `/benchmarks` directory at the repository root:

```
benchmarks/
├── core.bench.ts           # Core functionality benchmarks
├── steps.bench.ts          # Common step benchmarks
├── all-steps.bench.ts      # Comprehensive step coverage
└── vitest.config.ts        # Benchmark configuration
```

## Basic Benchmark Structure

Use Vitest's `bench` function to define benchmarks:

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, stepName } from '@valchecker/internal'

describe('Step Category - Operation Name', () => {
	bench('description of what is being benchmarked', () => {
		const v = createValchecker({ steps: [stepName, ...dependencies] })
		const schema = v.stepName(/* parameters */)
		schema.execute(/* test data */)
	})
})
```

## Step-by-Step Guide

### 1. Import Required Dependencies

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, yourStep } from '@valchecker/internal'
```

### 2. Create a Describe Block

Group related benchmarks together:

```typescript
describe('Step Category - Your Step', () => {
	// benchmarks go here
})
```

**Category examples**:
- Type Validators (`string`, `number`, `boolean`)
- String Operations (`toLowercase`, `startsWith`)
- Numeric Constraints (`min`, `max`, `integer`)
- Array Operations (`toFiltered`, `toSorted`)
- Object Operations (`object`, `strictObject`)
- Composition (`union`, `intersection`)
- Advanced Operations (`check`, `transform`, `fallback`)

### 3. Define Individual Benchmarks

Each benchmark should test a specific use case:

```typescript
bench('stepName - specific scenario', () => {
	const v = createValchecker({ steps: [yourStep] })
	const schema = v.yourStep(/* params */)
	schema.execute(/* representative data */)
})
```

## Benchmark Naming Convention

Use descriptive names that clearly indicate what is being measured:

```typescript
// Good names
bench('string - basic validation')
bench('string - with startsWith constraint')
bench('array - 100 objects')
bench('object - 10 field validation')
bench('transform - multiple transformations')

// Bad names
bench('test1')
bench('string')
bench('benchmark')
```

## Choosing Test Data

Select test data that represents realistic use cases:

### Basic Operations
```typescript
bench('string - basic validation', () => {
	const v = createValchecker({ steps: [string] })
	const schema = v.string()
	schema.execute('hello world') // Simple, representative string
})
```

### Array Operations
```typescript
bench('array - 10 strings', () => {
	const v = createValchecker({ steps: [array, string] })
	const schema = v.array(v.string())
	// Use realistic array size
	schema.execute(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
})
```

### Object Operations
```typescript
bench('object - 3 field validation', () => {
	const v = createValchecker({ steps: [object, string, number] })
	const schema = v.object({
		name: v.string(),
		age: v.number(),
		email: v.string(),
	})
	// Representative object
	schema.execute({ name: 'John', age: 30, email: 'john@example.com' })
})
```

## Common Benchmark Patterns

### Testing Different Scales

Benchmark the same operation at different scales to understand scalability:

```typescript
describe('Array Operations - Scalability', () => {
	bench('array - 10 elements', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		const data = Array.from({ length: 10 }, (_, i) => `item${i}`)
		schema.execute(data)
	})

	bench('array - 100 elements', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		const data = Array.from({ length: 100 }, (_, i) => `item${i}`)
		schema.execute(data)
	})

	bench('array - 1000 elements', () => {
		const v = createValchecker({ steps: [array, string] })
		const schema = v.array(v.string())
		const data = Array.from({ length: 1000 }, (_, i) => `item${i}`)
		schema.execute(data)
	})
})
```

### Testing Chained Operations

Benchmark steps in isolation and when chained:

```typescript
describe('Chained String Operations', () => {
	bench('toLowercase - alone', () => {
		const v = createValchecker({ steps: [string, toLowercase] })
		const schema = v.string().toLowercase()
		schema.execute('HELLO WORLD')
	})

	bench('toLowercase + startsWith - chained', () => {
		const v = createValchecker({ steps: [string, toLowercase, startsWith] })
		const schema = v.string().toLowercase().startsWith('hello')
		schema.execute('HELLO WORLD')
	})
})
```

### Success vs Failure Paths

Benchmark both success and failure scenarios when relevant:

```typescript
describe('Fallback Operations', () => {
	bench('fallback - success path (no fallback needed)', () => {
		const v = createValchecker({ steps: [string, fallback] })
		const schema = v.string().fallback('default')
		schema.execute('hello') // Valid input
	})

	bench('fallback - failure path (fallback applied)', () => {
		const v = createValchecker({ steps: [string, fallback] })
		const schema = v.string().fallback('default')
		schema.execute(42) // Invalid input triggers fallback
	})
})
```

## Running Benchmarks

### Run All Benchmarks
```bash
pnpm bench
```

### Run Specific Benchmark File
```bash
pnpm bench all-steps.bench.ts
```

### Watch Mode (for development)
```bash
pnpm bench:watch
```

## Interpreting Results

Benchmark output shows:
- **ops/sec**: Operations per second (higher is better)
- **mean**: Average execution time
- **min/max**: Fastest and slowest execution times
- **margin**: Statistical margin of error

Example output:
```
✓ benchmarks  all-steps.bench.ts > Type Validators
  · string - basic validation  415,374 ops/sec  ±8.34%
  · number - basic validation  391,341 ops/sec  ±8.59%
```

## Benchmark Checklist

When creating a benchmark for a step:

- [ ] **Location**: Benchmark is in the appropriate file (`all-steps.bench.ts` or a category-specific file)
- [ ] **Imports**: All required steps and utilities are imported
- [ ] **Describe Block**: Benchmark is grouped in a descriptive `describe()` block
- [ ] **Naming**: Benchmark name clearly describes what is being measured
- [ ] **Test Data**: Uses realistic, representative test data
- [ ] **Scale**: Tests relevant scales (e.g., small, medium, large arrays)
- [ ] **Scenarios**: Covers important scenarios (success/failure, chained/isolated)
- [ ] **Execution**: Benchmark actually executes the step (calls `.execute()`)
- [ ] **No Side Effects**: Benchmark doesn't modify external state
- [ ] **Consistency**: Follows the same patterns as existing benchmarks

## Best Practices

### DO:
- ✅ Use realistic test data
- ✅ Test at multiple scales when relevant
- ✅ Group related benchmarks together
- ✅ Use descriptive names
- ✅ Benchmark the actual execution path users will use
- ✅ Include both simple and complex scenarios
- ✅ Run benchmarks before and after optimizations

### DON'T:
- ❌ Use trivial or unrealistic test data
- ❌ Create benchmarks that don't actually execute the step
- ❌ Benchmark setup/initialization code (only the execution)
- ❌ Modify external state within benchmarks
- ❌ Use random data (makes results inconsistent)
- ❌ Copy-paste benchmarks without understanding them
- ❌ Ignore benchmark failures or warnings

## Example: Complete Benchmark for a New Step

Here's a complete example for a hypothetical `capitalize` step:

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, string, capitalize } from '@valchecker/internal'

describe('String Operations - Capitalize', () => {
	// Basic operation
	bench('capitalize - single word', () => {
		const v = createValchecker({ steps: [string, capitalize] })
		const schema = v.string().capitalize()
		schema.execute('hello')
	})

	// Multiple words
	bench('capitalize - multiple words', () => {
		const v = createValchecker({ steps: [string, capitalize] })
		const schema = v.string().capitalize()
		schema.execute('hello world from valchecker')
	})

	// Long string
	bench('capitalize - long string', () => {
		const v = createValchecker({ steps: [string, capitalize] })
		const schema = v.string().capitalize()
		const longString = 'this is a very long string with many words to test performance'.repeat(10)
		schema.execute(longString)
	})

	// Chained operations
	bench('capitalize - chained with toLowerCase', () => {
		const v = createValchecker({ steps: [string, toLowercase, capitalize] })
		const schema = v.string().toLowercase().capitalize()
		schema.execute('HELLO WORLD')
	})
})
```

## Integration with Development Workflow

### 1. Create the Step
Follow [How to Define a Step](./how-to-define-create-step.md)

### 2. Write Tests
Follow [How to Test a Step](./how-to-test-a-step.md)

### 3. Create Benchmark
Follow this guide to create performance benchmarks

### 4. Run Verification
```bash
# Ensure tests pass
pnpm test

# Run benchmarks
pnpm bench

# Check for performance regressions
# Compare ops/sec with previous baseline
```

## Maintaining Benchmarks

- **Update benchmarks** when step implementation changes significantly
- **Add benchmarks** for new scenarios or edge cases
- **Review benchmarks** during code reviews
- **Track performance** over time to catch regressions
- **Document significant changes** in benchmark results

## Additional Resources

- [Vitest Benchmarking Guide](https://vitest.dev/guide/features.html#benchmarking)
- [PERFORMANCE_REPORT.md](../benchmarks/PERFORMANCE_REPORT.md) - Performance optimization analysis
- [How to Test a Step](./how-to-test-a-step.md) - Testing guide
- [How to Define a Step](./how-to-define-create-step.md) - Step creation guide
