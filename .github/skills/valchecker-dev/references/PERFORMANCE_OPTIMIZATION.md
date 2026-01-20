# Performance Optimization Best Practices

## Performance Culture

At Valchecker, performance is non-negotiable:
- Every optimization must be benchmarked
- Performance regressions are not acceptable
- Hot paths are documented and optimized

## Identifying Bottlenecks

### Step 1: Run Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Run specific benchmark
pnpm bench -- packages/internal/src/steps/union/union.bench.ts

# Watch mode for iterative testing
pnpm bench:watch
```

### Step 2: Analyze Results

Benchmark output shows:
- Operations per second
- Time per operation (ms)
- Standard deviation
- Comparison with previous runs

### Step 3: Profile Hot Paths

Key performance-critical areas:

1. **Pipeline Execution** (`packages/internal/src/core/core.ts`)
   - `createPipeExecutor()` - Called for every validation
   - Step iteration and Promise detection

2. **Union Step** (`packages/internal/src/steps/union/`)
   - Branch selection and execution
   - Pre-computed executors optimization

3. **Intersection Step** (`packages/internal/src/steps/intersection/`)
   - Result merging
   - Issue accumulation

4. **Object Validation** (`packages/internal/src/steps/object/`)
   - Property iteration
   - Nested path tracking

## Optimization Techniques

### 1. Array Allocation

**Problem**: Unnecessary array allocations are expensive

**Bad**:
```typescript
// Creates new array each time
const items = [...someArray]
```

**Good**:
```typescript
// Pre-allocate with known size
const items = Array.from({ length: n })
for (let i = 0; i < n; i++) {
  items[i] = compute(i)
}
```

**Example from codebase**:
```typescript
// In createPipeExecutor - avoid spread operator
const pathLen = path.length
const existingLen = existingPath.length
const newPath = Array.from({ length: pathLen + existingLen })
for (let i = 0; i < pathLen; i++) {
  newPath[i] = path[i]
}
for (let i = 0; i < existingLen; i++) {
  newPath[pathLen + i] = existingPath[i]
}
```

### 2. Loop Optimization

**Problem**: Inefficient iteration patterns

**Bad**:
```typescript
steps.forEach((step, i) => {
  // forEach has function call overhead
  result = step(result)
})
```

**Good**:
```typescript
const len = steps.length
for (let i = 0; i < len; i++) {
  result = steps[i]!(result)
}
```

**Why**: Direct loops are faster than forEach.

### 3. Promise Detection

**Problem**: Checking for Promise repeatedly is expensive

**Bad**:
```typescript
for (let i = 0; i < len; i++) {
  result = steps[i]!(result)
  if (result instanceof Promise) {
    // Handle async - but this runs every iteration
  }
}
```

**Good**:
```typescript
let isAsync = false
for (let i = 0; i < len; i++) {
  if (isAsync) continue // Skip if already async

  result = steps[i]!(result)

  if (result instanceof Promise) {
    isAsync = true
  }
}
```

**Example from codebase** (`createPipeExecutor`):
- Once `isAsync` is detected, skip further sync processing
- Switch to Promise chain handling

### 4. Early Return

**Problem**: Unnecessary computation after error

**Bad**:
```typescript
const issues = []
for (let i = 0; i < len; i++) {
  const result = validateItem(items[i])
  if (result.issues) {
    issues.push(...result.issues)
  }
  // Keeps validating even if we have issues
}
```

**Good**:
```typescript
for (let i = 0; i < len; i++) {
  const result = validateItem(items[i])
  if (result.issues) {
    return result // Fail fast
  }
}
```

### 5. Pre-computation

**Problem**: Computing same values repeatedly

**Bad**:
```typescript
// union step - recomputes executors each execution
steps.forEach(step => {
  const result = executeStep(step)
  // ...
})
```

**Good**:
```typescript
// Pre-compute executors once
const executors = steps.map(step => createExecutor(step))

// Later, use pre-computed executors
executors.forEach(executor => {
  const result = executor()
})
```

**Valchecker Union Step**:
- Pre-computes branch executors at creation time
- Execution just runs pre-computed functions

### 6. Object Pooling

**Problem**: Creating many small objects is expensive

**Bad**:
```typescript
function validate(value) {
  const context = { value, path: [], issues: [] }
  // ... do work ...
  return context
}
```

**Good**: 
- Reuse context objects when possible
- Minimize allocations in hot paths

## Benchmarking Strategy

### Structure Benchmark Files

Each step with performance implications should have `*.bench.ts`:

```typescript
import { bench, describe } from 'vitest'

describe('stepName bench', () => {
  const schema = v.unknown().stepName()

  bench('fast path - valid value', () => {
    schema.execute(validValue)
  })

  bench('slow path - invalid value', () => {
    schema.execute(invalidValue)
  })

  bench('complex case', () => {
    schema.execute(complexValue)
  })
})
```

### Benchmark Best Practices

1. **Test realistic cases** - Use actual validation patterns
2. **Include multiple scenarios** - Fast path, slow path, edge cases
3. **Run multiple times** - Benchmarks show mean and deviation
4. **Compare before/after** - Use `pnpm bench:watch` to iterate

### Reading Benchmark Results

```
 ✓ bench/union.bench.ts (3 tests) 1234ms
    name:                                    hz      min      max     mean       p75       p99      p995      p999     rme
    ✓ union - single branch valid          1,234 0.0008 0.0021 0.0008 0.0009 0.0012 0.0015 123.45%
    ✓ union - all branches valid           1,567 0.0006 0.0018 0.0006 0.0007 0.0010 0.0013 98.76%
    ✓ union - invalid in all branches        890 0.0011 0.0025 0.0011 0.0013 0.0016 0.0019 145.32%
```

- `hz`: Operations per second (higher is better)
- `mean`: Average time per operation (lower is better)
- `rme`: Relative margin of error (lower is more consistent)

## Common Optimization Patterns

### Pattern 1: Cache Computations

```typescript
// Step setup - run once
const expectedType = inferType()
const validationFn = compileValidation()

// Step execution - just use cached values
step(value, issue) {
  if (typeof value !== expectedType) return { issue }
  return validationFn(value)
}
```

### Pattern 2: Lazy Evaluation

```typescript
// Only compute when needed
step(value, issue) {
  if (quickCheckFails(value)) {
    return { issue }
  }

  // Expensive computation only if quick check passes
  const result = expensiveValidation(value)
  return { value: result }
}
```

### Pattern 3: Batch Operations

```typescript
// Process multiple items efficiently
const results = []
for (let i = 0; i < len; i++) {
  results[i] = process(items[i])
}
return results
```

### Pattern 4: Skip Redundant Work

```typescript
let isAsync = false
for (let i = 0; i < len; i++) {
  if (isAsync) break // Don't process sync code if async

  result = executeStep(result)
  if (result instanceof Promise) {
    isAsync = true
  }
}
```

## Memory Optimization

### Reduce Allocations

```typescript
// Bad: Multiple allocations
const copy1 = [...array]
const copy2 = copy1.map(x => x)
const copy3 = copy2.filter(x => check(x))

// Good: Single allocation and transformation
const result = array.filter(x => check(x))
```

### Object Size

```typescript
// Minimize object properties
const issue = {
  code,
  message,
  path,
  payload
}

// vs bloated with extra data
const issue = {
  code,
  message,
  path,
  payload,
  timestamp,
  id,
  severity,
  // ... etc
}
```

## Bundle Size Optimization

### Track with pkg-size

Each build automatically runs `pkg-size`:

```bash
pnpm build
# Reports bundle size for each package
```

### Techniques to Reduce Size

1. **Tree-shaking** - Unused code is removed
2. **Minification** - Build output is minified
3. **Code splitting** - Export only what's needed
4. **No dependencies** - Minimize external deps

## Performance Regression Prevention

### Continuous Benchmarking

1. **Before optimization**: `pnpm bench`
2. **After optimization**: `pnpm bench` again
3. **Compare results** - Verify improvement
4. **Add benchmark** - Include in commit

### Benchmark in CI

Benchmarks should run in:
- Pull request checks
- Before releases
- Regular intervals

## Performance Checklist

Before committing optimizations:

- [ ] Run `pnpm bench` to measure improvement
- [ ] Verify no functional regressions with `pnpm test`
- [ ] Check code readability isn't sacrificed
- [ ] Update benchmark in `*.bench.ts` if needed
- [ ] Document optimization in commit message
- [ ] Include benchmark results in PR description

## Documentation of Hot Paths

### Marking Performance-Critical Code

```typescript
/* @__NO_SIDE_EFFECTS__ */
export function createPipeExecutor(...) {
  // Performance-critical pipeline executor
  // Optimized for minimal allocations
  // See benchmarks in core.bench.ts
}
```

### Performance Comments

```typescript
// Direct loop is faster than forEach (~30% improvement)
for (let i = 0; i < len; i++) {
  result = steps[i]!(result)
}
```

## Tools and Utilities

### Vitest Benchmarking

```bash
pnpm bench              # Run benchmarks
pnpm bench:watch        # Watch mode for iterative development
pnpm bench -- --reporter=verbose  # Detailed output
```

### Profiling

For detailed profiling:
```bash
node --prof script.js
node --prof-process isolate-*.log > profile.txt
```

---

See ARCHITECTURE.md for performance optimization points in the codebase.
