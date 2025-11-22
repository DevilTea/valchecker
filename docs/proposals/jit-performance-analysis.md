# JIT Performance Analysis

## Current Performance Baseline

This document analyzes the current performance characteristics of valchecker's interpreter-based execution model and projects potential JIT improvements.

## Execution Path Analysis

### Single String Validation

**Schema:**
```typescript
const schema = v.string()
```

**Current Execution Path:**
1. Call `schema.execute('hello')`
2. Enter `createPipeExecutor` closure
3. Initialize result object: `{ value: 'hello' }`
4. Loop: `for (let i = 0; i < 1; i++)`
5. Call `runtimeSteps[0](result)`
6. Enter error handling wrapper (try-catch)
7. Check `isSuccess(result)` (property lookup)
8. Call step function with `value`
9. Type check: `typeof value === 'string'`
10. Create success object: `{ value }`
11. Return through wrappers

**Estimated overhead:**
- Function calls: ~4 (executor → wrapper → isSuccess check → step)
- Property lookups: ~3
- Object allocations: ~2
- Conditional branches: ~2

### Complex String Validation

**Schema:**
```typescript
const schema = v.string()
	.toTrimmed()
	.min(3)
	.max(50)
```

**Current Execution Path:**
1. Call `schema.execute('  hello  ')`
2. Enter `createPipeExecutor` closure
3. Initialize: `{ value: '  hello  ' }`
4. Loop iteration 1: string check
   - Wrapper overhead
   - Type check
   - Pass result
5. Loop iteration 2: trim
   - Wrapper overhead
   - Success check
   - Call `.trim()`
   - Create new result object
6. Loop iteration 3: min length
   - Wrapper overhead
   - Success check
   - Length check
   - Create new result object
7. Loop iteration 4: max length
   - Wrapper overhead
   - Success check
   - Length check
   - Create new result object

**Estimated overhead per step:**
- Function calls: ~3 per step
- Property lookups: ~2 per step
- Object allocations: 1 per step
- Conditional branches: ~2 per step

**Total for 4 steps:**
- Function calls: ~12
- Property lookups: ~8
- Object allocations: 4
- Conditional branches: ~8

## JIT Optimization Potential

### Compiled Version (Hypothetical)

**Generated Code:**
```typescript
function compiled_string_trim_min_max(value) {
	// Direct inline checks, no function boundaries
	if (typeof value !== 'string') {
		return { issues: [stringTypeError(value)] }
	}

	value = value.trim()

	if (value.length < 3) {
		return { issues: [minLengthError(value, 3)] }
	}

	if (value.length > 50) {
		return { issues: [maxLengthError(value, 50)] }
	}

	return { value }
}
```

**Optimizations achieved:**
- Zero loop iterations (unrolled)
- No intermediate result objects
- No function boundaries between steps
- Single return object allocation
- Direct type and length checks

**Estimated overhead:**
- Function calls: 1 (entry only, error paths may call helper)
- Property lookups: ~2 (length checks)
- Object allocations: 1 (final result)
- Conditional branches: 3

**Improvement:**
- Function calls: 12 → 1 (12x reduction)
- Object allocations: 4 → 1 (4x reduction)
- Conditional branches: 8 → 3 (2.6x reduction)

## Expected Performance Gains

### Micro-benchmark Projections

Based on similar JIT implementations in validation libraries:

| Schema Complexity | Current (ops/sec) | JIT (ops/sec) | Speedup |
|------------------|-------------------|---------------|---------|
| Single primitive | 10M | 30M | 3x |
| Simple chain (3-4 steps) | 5M | 20M | 4x |
| Complex chain (8+ steps) | 2M | 12M | 6x |
| Nested object | 1M | 5M | 5x |
| Array validation | 500K | 2.5M | 5x |

**Note:** These are estimates based on:
- AJV's JIT showing 2-5x improvements
- Valibot's optimized pipeline showing 3-4x improvements
- V8's typical speedup for monomorphic code

### Real-world Impact Scenarios

#### API Request Validation
**Scenario:** Express.js middleware validating 1000 req/sec

**Current:**
- Validation time: 0.2ms per request
- Total CPU: 200ms/sec (20% of 1 core)

**With JIT:**
- Validation time: 0.05ms per request
- Total CPU: 50ms/sec (5% of 1 core)
- **Benefit:** 75% reduction in validation overhead

#### Form Input Validation
**Scenario:** Real-time validation on keystroke (100 validations/sec)

**Current:**
- Validation time: 0.1ms per check
- Noticeable on slower devices

**With JIT:**
- Validation time: 0.025ms per check
- **Benefit:** Imperceptible latency

#### Batch Data Processing
**Scenario:** Processing 100K records with validation

**Current:**
- Validation time: 20 seconds
- Memory pressure from intermediate objects

**With JIT:**
- Validation time: 4 seconds
- **Benefit:** 80% time reduction, less GC pressure

## Memory Characteristics

### Current Interpreter

**Memory per execution:**
```
Result objects: N steps × ~200 bytes = N × 200 bytes
Function closures: Shared across executions = ~1KB
Total per call: ~(N × 200 bytes) transient
```

**Example (4-step pipeline):**
- Transient: ~800 bytes per execution
- Steady-state: ~1KB for closures

### Compiled JIT

**Memory overhead:**
```
Compiled function: ~500 bytes per schema (one-time)
Helper references: ~200 bytes
Result object: 1 × ~200 bytes per execution
Total per call: ~200 bytes transient + 700 bytes fixed
```

**Trade-off:**
- Higher fixed cost: +700 bytes per compiled schema
- Lower per-execution cost: ~(N-1) × 200 bytes saved
- Break-even: After ~4 executions for 4-step pipeline

## V8 Optimization Alignment

### Current Code Issues

1. **Polymorphic Result Objects**
   ```typescript
   // Different shapes at each step
   { value: string }
   { value: string } // after trim
   { value: string } // after min check
   ```
   - Each object might have different hidden classes
   - Prevents V8 IC from staying monomorphic

2. **Megamorphic Function Calls**
   ```typescript
   runtimeSteps[i](result) // Different functions each time
   ```
   - Function identity changes in loop
   - Cannot be optimized by V8's speculative compiler

3. **Try-Catch in Hot Path**
   ```typescript
   function wrapWithErrorHandling(fn) {
   	return (result) => {
   		try {
   			const r = fn(result)
   		// ...
   		}
   		catch (error) {
   		// ...
   		}
   	}
   }
   ```
   - Prevents certain V8 optimizations
   - Forces deoptimization in error cases

### JIT Improvements

1. **Monomorphic Result Objects**
   ```typescript
   // Always same shape
   const result = { value: null }
   result.value = validatedValue
   return result
   ```
   - Single hidden class
   - IC stays in monomorphic state

2. **Static Code Path**
   ```typescript
   // No dynamic dispatch
   if (typeof value !== 'string')
   	return error1
   value = value.trim()
   if (value.length < 3)
   	return error2
   ```
   - V8 can inline everything
   - Maglev/TurboFan optimize aggressively

3. **Localized Try-Catch**
   ```typescript
   // Only wrap the compiled function call
   try {
   	return compiledFn(value)
   }
   catch (e) {
   	return unknownError(e)
   }
   ```
   - Try-catch at boundary only
   - Interior remains optimizable

## Compilation Cost Analysis

### Compilation Time

**Simple schema (3-4 steps):**
- Analysis: ~0.1ms
- Code generation: ~0.5ms
- `new Function()`: ~0.5ms
- **Total: ~1.1ms**

**Complex schema (10+ steps):**
- Analysis: ~0.3ms
- Code generation: ~2ms
- `new Function()`: ~1.5ms
- **Total: ~3.8ms**

### Break-even Point

**Formula:**
```
Break-even = Compilation Cost / (Interpreter Time - JIT Time)
```

**Example (4-step string validation):**
```
Compilation: 1.1ms
Interpreter: 0.2ms per execution
JIT: 0.05ms per execution
Savings: 0.15ms per execution

Break-even = 1.1ms / 0.15ms ≈ 7 executions
```

**Recommendation:** Compile after 10 executions (safe margin)

## Benchmark Methodology

### Proposed Benchmark Suite

1. **Primitive Validations**
   - `v.string()`
   - `v.number()`
   - `v.boolean()`

2. **Simple Chains**
   - `v.string().toTrimmed().min(3)`
   - `v.number().min(0).max(100)`

3. **Complex Chains**
   - `v.string().toTrimmed().toLowercase().min(3).max(50).regex(/^[a-z]+$/)`
   - `v.number().integer().min(1).max(1000000).check(isPrime)`

4. **Structural**
   - `v.object({ name: v.string(), age: v.number() })`
   - `v.array(v.string()).min(1).max(10)`

5. **Nested**
   - Deep object nesting (5 levels)
   - Array of objects with multiple fields

6. **Real-world**
   - User registration form
   - API request payload
   - Configuration file

### Metrics to Measure

1. **Throughput**: Operations per second
2. **Latency**: P50, P95, P99 execution time
3. **Memory**: Heap usage, GC pressure
4. **Compilation Cost**: Time to compile
5. **Code Size**: Generated function size

## Conclusion

Based on this analysis:

1. **Performance Gain Potential**: 3-6x for typical schemas
2. **Memory Trade-off**: Acceptable (~700 bytes per schema)
3. **Break-even Point**: After ~10 executions
4. **V8 Alignment**: Significant improvements possible
5. **Implementation Priority**: High value for high-throughput scenarios

**Recommendation:** Proceed with Phase 1 (interpreter optimizations) first to establish accurate baseline, then Phase 2 (explicit compilation API) with comprehensive benchmarking.
