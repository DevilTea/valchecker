# Benchmarking Guide

Every step implementation requires a benchmark file to track performance.

## Benchmark File Template

```typescript
// step-name.bench.ts
import { bench, describe } from 'vitest'
import { createValchecker, /* required steps */ } from '../../../index'
import { stepName } from './step-name'

const v = createValchecker({ steps: [/* steps */] })

describe('stepName', () => {
  const schema = v./* chain */

  bench('valid input', () => {
    schema.run(validInput)
  })

  bench('invalid input', () => {
    schema.run(invalidInput)
  })
})
```

## Example Benchmarks

### Constraint Step

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, min, number } from '../../../index'

const v = createValchecker({ steps: [number, min] })

describe('min', () => {
  const schema = v.number().min(0)

  bench('valid input (positive)', () => {
    schema.run(100)
  })

  bench('invalid input (negative)', () => {
    schema.run(-100)
  })

  bench('boundary value (zero)', () => {
    schema.run(0)
  })
})
```

### Transform Step

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, string, toTrimmed } from '../../../index'

const v = createValchecker({ steps: [string, toTrimmed] })

describe('toTrimmed', () => {
  const schema = v.string().toTrimmed()

  bench('already trimmed', () => {
    schema.run('hello')
  })

  bench('leading whitespace', () => {
    schema.run('  hello')
  })

  bench('trailing whitespace', () => {
    schema.run('hello  ')
  })

  bench('both sides whitespace', () => {
    schema.run('  hello  ')
  })
})
```

### Complex Schema

```typescript
import { bench, describe } from 'vitest'
import { createValchecker, object, string, number } from '../../../index'

const v = createValchecker({ steps: [object, string, number] })

describe('complex object', () => {
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  })

  const validData = { name: 'Alice', age: 30 }
  const invalidData = { name: 'Alice', age: 'thirty' }

  bench('valid nested object', () => {
    schema.run(validData)
  })

  bench('invalid nested object', () => {
    schema.run(invalidData)
  })
})
```

## Running Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Run benchmarks with detailed output
pnpm bench -- --reporter=verbose

# Bench specific step
pnpm bench packages/internal/src/steps/step-name
```

## Benchmark Best Practices

1. **Test realistic scenarios**
   - Include both valid and invalid inputs
   - Use typical data sizes
   - Test edge cases

2. **Multiple iterations**
   - Vitest automatically runs multiple iterations
   - More iterations = better accuracy
   - Don't worry about exact numbers

3. **Meaningful names**
   ```typescript
   // ✓ Good - describes what's being tested
   bench('valid input (large string)', () => { ... })
   bench('invalid input (wrong type)', () => { ... })
   
   // ✗ Bad - too vague
   bench('test 1', () => { ... })
   bench('case 2', () => { ... })
   ```

4. **Consistent setup**
   - Reuse schema definitions
   - Don't include schema creation in benchmark
   - Focus on the `run()` call

5. **Compare similar scenarios**
   ```typescript
   // Good - compare related operations
   bench('valid number', () => {
     schema.run(42)
   })
   bench('valid number (boundary)', () => {
     schema.run(0)
   })
   
   // Less useful - too different
   bench('valid number', () => {
     schema.run(42)
   })
   bench('valid string', () => {
     schema.run('hello')
   })
   ```

## Interpreting Results

Benchmark output shows:
- **ops/sec**: Operations per second (higher is better)
- **margin**: Confidence interval
- **samples**: Number of iterations run

Example output:
```
✓ min (2 samples)
  ├─ valid input          x 2,345,678 ops/sec ±0.24%
  └─ invalid input        x 1,987,654 ops/sec ±0.31%
```

## Common Issues

### Benchmark too fast
If benchmark runs extremely quickly (> 10M ops/sec), the operation might be:
- Optimized away by the compiler
- Very trivial
- Not representative

Try adding more complex operations or larger inputs.

### Inconsistent results
If results vary significantly between runs:
- Close other applications
- Increase sample size (Vitest does this automatically)
- Check for external factors (CPU load, memory pressure)

### Benchmark file not found
Ensure file is named correctly: `step-name.bench.ts` and located in the step directory.
