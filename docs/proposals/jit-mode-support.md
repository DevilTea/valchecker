# JIT Mode Support Proposal

## Overview

This document discusses strategies for implementing Just-In-Time (JIT) compilation mode in valchecker to optimize validation performance for frequently-executed schemas.

## Current Architecture Analysis

### Execution Model

The current valchecker architecture uses an **interpreter pattern**:

1. **Schema Definition**: When users chain validation steps (e.g., `v.string().toTrimmed().min(3)`), each method call:
   - Creates a new proxy instance via `createInstance()`
   - Adds a runtime step function to the `runtimeSteps` array
   - Returns the new instance for further chaining

2. **Runtime Execution**: When `schema.execute(value)` is called:
   - `createPipeExecutor()` returns a function that loops through all `runtimeSteps`
   - Each step is executed sequentially with error handling
   - Results are passed from one step to the next
   - Async detection happens dynamically during execution

### Performance Characteristics

**Strengths:**
- Flexible and composable
- Easy to debug and understand
- Supports dynamic async/sync detection
- Minimal memory overhead during schema definition

**Potential Bottlenecks:**
- Function call overhead for each step
- Repeated proxy access on hot paths
- Dynamic type checking on every execution
- Array iteration overhead for long pipelines
- Error handling wrapper adds try-catch overhead to every step

## JIT Mode Concept

JIT (Just-In-Time) mode would **pre-compile** the validation pipeline into an optimized execution function, eliminating overhead from:
- Proxy access
- Array iteration
- Function boundaries between steps
- Repeated type checks

### Performance Goals

1. **Reduce Function Call Overhead**: Inline simple operations
2. **Eliminate Array Iteration**: Unroll the step loop
3. **Optimize Type Checks**: Use monomorphic patterns favored by V8
4. **Cache Compiled Functions**: Reuse compiled validators
5. **Preserve API Compatibility**: No breaking changes to existing API

## Implementation Strategies

### Strategy 1: Function Generation with `new Function()`

**Approach:** Generate optimized JavaScript code as a string and compile it using `new Function()`.

**Example:**
```typescript
// Input schema
const schema = v.string()
	.toTrimmed()
	.min(3)

// Generated code
const compiled = new Function('value', 'helpers', `
	"use strict";
	// Step 1: string check
	if (typeof value !== 'string') {
		return helpers.failure({
			code: 'string:expected_string',
			payload: { value },
			message: 'Expected a string.'
		});
	}

	// Step 2: trim
	value = value.trim();

	// Step 3: min length
	if (value.length < 3) {
		return helpers.failure({
			code: 'string:min_length',
			payload: { value, min: 3 },
			message: 'String must be at least 3 characters long.'
		});
	}

	return helpers.success(value);
`)
```

**Pros:**
- Maximum performance potential
- True compilation to native code via V8
- Can inline all simple operations
- Eliminates function call overhead

**Cons:**
- Code generation complexity
- Requires careful escaping and security considerations
- Harder to debug (generated code is harder to read)
- May not work in CSP-restricted environments
- Complex for async steps (requires Promise chain generation)

### Strategy 2: Lazy Compilation with Cached Fast Paths

**Approach:** Keep the interpreter but optimize hot schemas through profiling.

**Example:**
```typescript
class CompiledSchema {
	private _interpreterExecute: Function
	private _compiledExecute?: Function
	private _executionCount = 0
	private _shouldCompile = false

	execute(value: unknown) {
		this._executionCount++

		// Use interpreter for first N executions
		if (this._executionCount < COMPILATION_THRESHOLD) {
			return this._interpreterExecute(value)
		}

		// Compile on threshold
		if (!this._compiledExecute) {
			this._compiledExecute = this._compile()
		}

		return this._compiledExecute(value)
	}

	private _compile() {
		// Analyze steps and generate optimized function
		return generateOptimizedExecutor(this.runtimeSteps)
	}
}
```

**Pros:**
- Automatic optimization for hot paths
- Maintains debugging in development
- Gradual performance improvement
- Easier to implement incrementally

**Cons:**
- Initial executions still slow
- Memory overhead for tracking
- Complexity in deciding when to compile

### Strategy 3: AOT (Ahead-of-Time) Compilation API

**Approach:** Provide an explicit `.compile()` method for users to opt-in.

**Example:**
```typescript
// User explicitly requests compilation
const schema = v.string()
	.toTrimmed()
	.min(3)
	.compile()

// Internal implementation
class Schema {
	compile() {
		const compiledFn = compileSteps(this.runtimeSteps)
		return {
			execute: compiledFn,
			isSuccess,
			isFailure,
		}
	}
}
```

**Pros:**
- Explicit user control
- Clear performance expectations
- No breaking changes (additive API)
- Can return simplified interface (no more chaining after compile)
- Easy to document and explain

**Cons:**
- Requires user awareness and action
- Different API surface (compiled vs non-compiled)
- May not optimize schemas defined in libraries

### Strategy 4: Hybrid Interpreter with Fast Paths

**Approach:** Keep the interpreter but add fast paths for common patterns.

**Example:**
```typescript
function createPipeExecutor(runtimeSteps) {
	// Detect if this is a simple, synchronous-only pipeline
	const pattern = analyzeStepsPattern(runtimeSteps)

	if (pattern === 'simple-string-validation') {
		return createFastStringValidator(runtimeSteps)
	}

	if (pattern === 'simple-number-validation') {
		return createFastNumberValidator(runtimeSteps)
	}

	// Fall back to general interpreter
	return createGeneralExecutor(runtimeSteps)
}

function createFastStringValidator(steps) {
	// Optimized path for common string validations
	return (value) => {
		if (typeof value !== 'string') {
			return stringTypeError(value)
		}

		let str = value
		for (const step of steps) {
			// Direct switch on step type, no function calls
			switch (step.type) {
				case 'trim': str = str.trim(); break
				case 'min': if (str.length < step.min)
					return minError(str, step.min); break
				// ... other fast paths
			}
		}

		return { value: str }
	}
}
```

**Pros:**
- No API changes
- Automatic optimization for common patterns
- Easy to implement incrementally
- Maintains full flexibility for complex cases

**Cons:**
- Limited optimization scope
- Requires maintaining two code paths
- Pattern detection overhead

## Recommended Approach

Based on analysis of the codebase and consideration of maintainability, I recommend a **phased implementation**:

### Phase 1: Foundation (Low Risk, High Value)
1. **Optimize `createPipeExecutor`**:
   - Pre-allocate result objects
   - Use monomorphic patterns for better V8 optimization
   - Reduce closure allocations

2. **Add fast paths for common primitives**:
   - Special case for single-step schemas (e.g., just `v.string()`)
   - Optimize common chains (e.g., `string + trim + min`)

3. **Profile and measure**:
   - Add benchmarks for various schema patterns
   - Identify real bottlenecks with profiling data

### Phase 2: Explicit Compilation API (Medium Risk, High Value)
1. **Add `.compile()` method**:
   ```typescript
   interface Schema {
   	compile: () => CompiledSchema
   }

   interface CompiledSchema {
   	execute: (value: unknown) => ExecutionResult
   	// No chaining methods
   }
   ```

2. **Implement code generation**:
   - Start with synchronous-only schemas
   - Generate optimized functions using `new Function()`
   - Handle simple transformations and checks

3. **Provide configuration options**:
   ```typescript
   const schema = v.string()
   	.toTrimmed()
   	.min(3)
   	.compile({
   		mode: 'fast', // or 'debug'
   		inline: true, // inline simple operations
   	})
   ```

### Phase 3: Auto-compilation (High Risk, High Value)
1. **Add automatic detection**:
   - Track execution count
   - Auto-compile after threshold
   - Provide configuration to disable

2. **Implement deoptimization**:
   - Handle cases where compiled version can't execute
   - Fall back to interpreter gracefully

## Technical Considerations

### Type Safety
- Compiled schemas must maintain full TypeScript type inference
- Return types must match interpreter mode exactly
- Consider: `CompiledSchema<Input, Output>` generic type

### Async Handling
- Async steps are harder to compile efficiently
- May need to exclude async schemas from JIT initially
- Could use async function generation: `new AsyncFunction(...)`

### Memory Management
- Compiled functions increase memory usage
- Need clear cache eviction strategy
- Consider: WeakMap for automatic GC of unused compiled schemas

### CSP (Content Security Policy)
- `new Function()` violates CSP in some environments
- Need fallback to interpreter mode
- Document CSP considerations

### Error Messages
- Compiled code must produce identical error messages
- Need to bundle message resolution into compiled function
- Consider passing message handlers as parameters

### Debugging
- Provide source maps or debug info for compiled functions
- Add option to disable compilation in development
- Consider: `.compile({ debug: true })` to keep readable code

## V8 Engine Optimization Alignment

Based on the existing performance guide in the repository, JIT compilation should leverage:

1. **Monomorphic Operations**:
   - Keep object shapes consistent
   - Avoid polymorphic property access
   - Use consistent type patterns

2. **Inline Caching**:
   - Generate code that V8's IC can optimize
   - Avoid megamorphic calls

3. **Hidden Classes**:
   - Initialize result objects with consistent shape
   - Avoid adding properties dynamically

4. **Array Element Kinds**:
   - Pre-allocate arrays with correct types
   - Avoid holey arrays in hot paths

5. **Deoptimization Avoidance**:
   - Keep compiled functions type-stable
   - Avoid operations that trigger deopt

## Migration Path for Users

### No Breaking Changes
- Existing code continues to work without modification
- Performance improvements are opt-in initially
- Can become automatic in future major version

### Opt-in Compilation
```typescript
// Explicit compilation for maximum performance
const schema = v.string()
	.toTrimmed()
	.min(3)
const compiled = schema.compile()

// Use compiled version
const result = compiled.execute(userInput)
```

### Configuration at Valchecker Level
```typescript
// Enable JIT for all schemas
const v = createValchecker({
	steps: allSteps,
	jit: {
		enabled: true,
		threshold: 10, // compile after 10 executions
		mode: 'auto', // or 'explicit'
	},
})
```

## Testing Strategy

1. **Functional Equivalence Tests**:
   - All existing tests must pass with JIT enabled
   - Compiled schemas must produce identical results to interpreter

2. **Performance Benchmarks**:
   - Measure compilation overhead
   - Compare execution speed: interpreter vs compiled
   - Test with various schema complexities

3. **Memory Tests**:
   - Monitor compiled function memory usage
   - Test cache eviction
   - Measure GC impact

4. **Edge Cases**:
   - Async/sync mixing
   - Deeply nested schemas
   - Very long pipelines
   - Custom message handlers
   - Error path coverage

## Open Questions for Discussion

1. **Should JIT be opt-in or automatic?**
   - Opt-in: More predictable, explicit control
   - Automatic: Better DX, but may surprise users

2. **How to handle async steps in compilation?**
   - Exclude from JIT completely?
   - Generate async function code?
   - Mixed approach?

3. **What compilation threshold makes sense?**
   - Too low: waste compilation time on one-off validations
   - Too high: miss optimization opportunities

4. **Should compiled schemas support chaining?**
   - Simpler if compiled schemas are "terminal"
   - But breaks composability pattern

5. **How to balance bundle size vs performance?**
   - JIT infrastructure adds code
   - Is the tradeoff worth it for all users?

6. **Should we support CSP-safe mode only?**
   - Limits optimization potential
   - But works in all environments

7. **What metrics should trigger compilation?**
   - Execution count only?
   - Schema complexity?
   - Runtime performance measurements?

## Next Steps

1. **Gather Feedback**: Discuss this proposal with maintainers and community
2. **Spike/Prototype**: Build minimal POC to validate approach
3. **Benchmark**: Measure actual performance gains on real-world schemas
4. **Decide**: Choose implementation strategy based on data
5. **Plan**: Break down work into implementable phases
6. **Execute**: Start with Phase 1 (low-risk optimizations)

## References

- V8 Performance Guide (in repository): `agents_guides/how-to-improve-performance.md`
- Similar implementations:
  - Valibot: Modular validation library with focus on bundle size
  - Zod: Popular TypeScript-first validation with extensive optimizations
  - AJV: JSON schema validator with JIT compilation
  - Yup: Schema builder with synchronous/async validation

## Conclusion

JIT mode support can significantly improve valchecker performance for hot validation paths. The recommended phased approach balances:
- **Short-term**: Low-risk optimizations to existing interpreter
- **Medium-term**: Explicit compilation API for power users
- **Long-term**: Automatic compilation based on profiling

This approach maintains API stability while providing clear performance benefits for users who need them.
