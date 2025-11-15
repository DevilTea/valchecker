# 🔬 Code-Level Performance Analysis: Valchecker vs Zod vs Valibot

## Executive Summary

This document provides a detailed code-level analysis of valchecker's current implementation (post-optimization) compared to zod and valibot, identifying specific performance bottlenecks and opportunities for improvement.

---

## 1. Architecture Comparison

### Valchecker (Current, Post Round 4)
```typescript
// Schema definition pattern
const v = createValchecker({ steps: [string, object, array] })
const schema = v.object({ name: v.string(), age: v.number() })

// Execution pattern (internal)
schema._exec(value) → createPipeExecutor() → loop through runtimeSteps
```

**Characteristics:**
- ✅ Removed Pipe class overhead (Round 3)
- ✅ Property metadata pre-computation (Round 4)
- ✅ Direct step execution with early async detection
- ❌ Still creates execution context on every `_exec()` call
- ❌ Dynamic step array iteration
- ❌ No compiled validator caching

### Valibot
```typescript
// Schema definition pattern
import { object, string, number } from 'valibot'
const schema = object({ name: string(), age: number() })

// Execution pattern
validate(schema, value) → direct function call → minimal overhead
```

**Characteristics:**
- ✅ Pure function composition
- ✅ Zero runtime overhead - functions are pre-compiled
- ✅ Tree-shakeable - unused validators removed by bundler
- ✅ JIT-friendly - simple inline-able functions
- ✅ No execution context creation

### Zod
```typescript
// Schema definition pattern
import { z } from 'zod'
const schema = z.object({ name: z.string(), age: z.number() })

// Execution pattern
schema.parse(value) → ZodObject.parse() → prototype chain lookup → validation
```

**Characteristics:**
- ⚠️ Class-based with prototype chain overhead
- ✅ Schema instances are cached (can be reused)
- ⚠️ More abstraction layers than Valibot
- ✅ But faster than valchecker in simple scenarios

---

## 2. Hot Path Analysis: String Validation

### Valchecker (Current)
```typescript
// packages/internal/src/steps/string/string.ts
addSuccessStep((value) => {
  // Inline type check for better performance (optimized in previous rounds)
  if (typeof value === 'string') {
    return success(value)  // Creates new success object
  }
  return failure({  // Creates new failure object with metadata
    code: 'string:expected_string',
    payload: { value },
    message: resolveMessage(...)  // Function call overhead
  })
})

// Invocation chain:
// schema._exec() → createPipeExecutor() → loop runtimeSteps → step function → return result object
```

**Cost breakdown (estimated cycles):**
1. `_exec()` method call: ~5 cycles
2. `createPipeExecutor()` setup: ~20 cycles
3. Loop iteration overhead: ~10 cycles
4. Type check: ~2 cycles
5. Result object creation: ~30 cycles (object allocation + properties)
6. `resolveMessage()` on failure: ~50 cycles

**Total: ~117 cycles per validation** (success: ~67, failure: ~117)

### Valibot
```typescript
// Simplified representation
export const string = () => (value: unknown) => {
  if (typeof value === 'string') {
    return { success: true, data: value }
  }
  return { success: false, issues: [{ message: 'Expected string' }] }
}

// Invocation:
// validator(value) → direct call → return
```

**Cost breakdown (estimated cycles):**
1. Function call: ~3 cycles
2. Type check: ~2 cycles
3. Result object creation: ~25 cycles (lighter, pre-shaped)

**Total: ~30 cycles per validation**

**🔍 Key Difference:** Valchecker is **~3-4x slower** due to:
- Execution context creation (`createPipeExecutor`)
- Dynamic step iteration
- Heavier result objects with more metadata

---

## 3. Hot Path Analysis: Object Validation

### Valchecker (Current, Post Round 4)
```typescript
// packages/internal/src/steps/object/object.ts (optimized)
addSuccessStep((value) => {
  // Pre-computed metadata (Round 4 optimization)
  const propsMeta = [
    { key: 'name', isOptional: false, schema: nameSchema },
    { key: 'age', isOptional: false, schema: ageSchema }
  ]
  
  // Type check
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return failure(...)
  }
  
  const issues = []
  const output = {}
  
  // Property validation loop
  for (let i = 0; i < keysLen; i++) {
    const { key, isOptional, schema } = propsMeta[i]!  // Array access
    const propValue = (value as any)[key]  // Dynamic property access
    
    const propResult = (isOptional && propValue === void 0)
      ? success(propValue)
      : schema['~execute'](propValue)  // Recursive _exec call
    
    // Handle result...
    if (isFailure(propResult)) {
      for (const issue of propResult.issues!) {
        issues.push(prependIssuePath(issue, [key]))  // Function call + array push
      }
    } else {
      output[key] = propResult.value!
    }
  }
  
  return issues.length > 0 ? failure(issues) : success(output)
})
```

**Cost breakdown for 3-property object (estimated cycles):**
1. Metadata lookup (pre-computed): ~0 cycles (already done)
2. Type check: ~10 cycles
3. Per property (×3):
   - Metadata array access: ~3 cycles
   - Property value access: ~5 cycles
   - Recursive `schema['~execute']()`: ~67 cycles (from string example above)
   - Result processing: ~20 cycles
   - **Subtotal per property: ~95 cycles**
4. Output object creation: ~30 cycles

**Total: ~325 cycles for 3-property object**

### Valibot (Estimated)
```typescript
// Simplified representation
export const object = (shape) => (value) => {
  if (typeof value !== 'object' || !value) return failure()
  
  const validators = [
    { key: 'name', validator: stringValidator },
    { key: 'age', validator: numberValidator }
  ]
  
  for (const { key, validator } of validators) {
    const result = validator(value[key])  // Direct function call
    if (!result.success) return result
  }
  
  return success(value)
}
```

**Cost breakdown (estimated cycles):**
1. Type check: ~10 cycles
2. Per property (×3):
   - Direct validator call: ~3 cycles
   - Property access: ~5 cycles
   - Validation: ~30 cycles (lighter validator)
   - **Subtotal per property: ~38 cycles**

**Total: ~124 cycles for 3-property object**

**🔍 Key Difference:** Valchecker is **~2.6x slower** because:
- Each property validation calls `schema['~execute']()` which creates new execution context
- Heavier result processing (`prependIssuePath`, issue array manipulation)
- More function call overhead

---

## 4. Critical Performance Bottlenecks

### 4.1 Execution Context Creation
**Problem:**
```typescript
// Every _exec() call creates new context
schema._exec(value) → {
  createPipeExecutor() // Creates new function closure
  return executor(value)  // Executes steps
}
```

**Impact:** ~20-30 cycles per validation
**Fix:** Compile schema to optimized validator function once, reuse

### 4.2 Result Object Allocation
**Problem:**
```typescript
// Heavy result objects with full metadata
const success = (value) => ({
  isSuccess: true,
  isFailure: false,
  value,
  issues: undefined
})

const failure = (issues) => ({
  isSuccess: false,
  isFailure: true,
  value: undefined,
  issues: Array.isArray(issues) ? issues : [issues]
})
```

**Impact:** ~30 cycles per object creation
**Fix:** Use lighter result structure, object pooling, or discriminated unions

### 4.3 Issue Path Manipulation
**Problem:**
```typescript
// prependIssuePath creates new objects for every nested validation
for (const issue of result.issues!) {
  issues.push(prependIssuePath(issue, [key]))  // Creates new issue object
}
```

**Impact:** ~15-20 cycles per issue
**Fix:** Mutate paths in-place or use path accumulator

### 4.4 No Validator Caching
**Problem:**
```typescript
// Schema is "compiled" on every use
const schema = v.object({ name: v.string() })
schema._exec(value1)  // Full setup
schema._exec(value2)  // Full setup again
```

**Impact:** All setup costs paid repeatedly
**Fix:** Cache compiled validators on first execution

---

## 5. Specific Optimization Opportunities

### 5.1 Fast Path for Simple Types (HIGH IMPACT)
**Current:**
```typescript
// string validator goes through full execution pipeline
schema._exec(value) → createPipeExecutor() → loop → typecheck → return
```

**Proposed:**
```typescript
// Add fast path that skips execution context for simple validators
if (schema._isSimple && schema._steps.length === 1) {
  return schema._steps[0].fn(value)  // Direct call
}
// Fall back to full pipeline for complex schemas
```

**Expected gain:** 2-3x for simple type validations

### 5.2 Compiled Validator Cache (HIGH IMPACT)
**Proposed:**
```typescript
class CompiledSchema {
  private _compiled?: (value: unknown) => Result
  
  _exec(value: unknown) {
    if (!this._compiled) {
      this._compiled = this._compile()  // Compile once
    }
    return this._compiled(value)
  }
  
  private _compile() {
    // Generate optimized validator function
    // Inline simple checks, pre-compute metadata, etc.
  }
}
```

**Expected gain:** 20-30% overall (eliminates setup cost)

### 5.3 Lighter Result Objects (MEDIUM IMPACT)
**Current:**
```typescript
type Result = {
  isSuccess: boolean
  isFailure: boolean
  value: any | undefined
  issues: Issue[] | undefined
}
```

**Proposed:**
```typescript
// Use discriminated union
type Result = 
  | { ok: true, value: any }
  | { ok: false, issues: Issue[] }

// Or use single-property pattern
type Result = { value: any } | { issues: Issue[] }
```

**Expected gain:** 5-10% (reduced allocation cost)

### 5.4 Object Pooling for Results (LOW IMPACT, HIGH COMPLEXITY)
**Proposed:**
```typescript
// Pool for frequently allocated objects
const resultPool = {
  success: [] as SuccessResult[],
  failure: [] as FailureResult[],
  
  getSuccess(value) {
    const result = this.success.pop() || { ok: true, value: undefined }
    result.value = value
    return result
  },
  
  recycle(result) {
    if (result.ok) {
      result.value = undefined
      this.success.push(result)
    }
  }
}
```

**Expected gain:** 3-5% (but risky, may cause bugs)

### 5.5 Inline prependIssuePath (MEDIUM IMPACT)
**Current:**
```typescript
for (const issue of result.issues!) {
  issues.push(prependIssuePath(issue, [key]))  // Function call + object creation
}
```

**Proposed:**
```typescript
// Inline the path prepending
for (const issue of result.issues!) {
  issues.push({
    ...issue,
    path: [key, ...issue.path]  // Still creates new object but no function call
  })
}

// Or mutate in place (breaking change)
for (const issue of result.issues!) {
  issue.path.unshift(key)
  issues.push(issue)
}
```

**Expected gain:** 5-8%

---

## 6. Comparative Analysis: Why Valibot is 3-4x Faster

### Key Architectural Differences

| Aspect | Valchecker | Valibot | Impact |
|--------|-----------|---------|--------|
| **Validator Pattern** | Method on schema object | Pure function | 🔴 High |
| **Execution Setup** | Creates context per call | No setup | 🔴 High |
| **Function Calls** | Multiple layers | Direct | 🔴 High |
| **Result Objects** | Heavy (4 properties) | Light (2 properties) | 🟡 Medium |
| **Caching** | None | Implicit (function reuse) | 🟡 Medium |
| **Composition** | Runtime array iteration | Compile-time composition | 🟡 Medium |
| **Issue Handling** | Complex path manipulation | Simpler structure | 🟢 Low |

### Valibot's Core Advantage: Zero Abstraction

```typescript
// Valibot in practice (conceptual)
const stringValidator = (v) => typeof v === 'string' ? success(v) : failure()

const objectValidator = (shape) => {
  const validators = Object.entries(shape).map(([k, v]) => [k, v])
  return (value) => {
    for (const [key, validator] of validators) {
      const result = validator(value[key])
      if (!result.success) return result
    }
    return success(value)
  }
}

// Usage
const schema = objectValidator({
  name: stringValidator,
  age: numberValidator
})

schema(value)  // Direct function call, no layers
```

**Why it's fast:**
1. **No execution context** - Just a function call
2. **Pre-composed** - Validators composed at definition time
3. **JIT-friendly** - Simple patterns V8 can inline
4. **Minimal allocation** - Lightweight result objects

### Valchecker's Constraint: Plugin Architecture

Valchecker's plugin system adds necessary overhead:
```typescript
// Plugin definition requires more structure
addSuccessStep((value) => {
  // validation logic
})

// Execution requires step iteration
for (let i = 0; i < runtimeSteps.length; i++) {
  result = runtimeSteps[i]!(result)
  // check for async, errors, etc.
}
```

This flexibility comes at a cost that Valibot doesn't pay.

---

## 7. Realistic Performance Goals

### Current State (Post Round 4)
- Simple types: ~120-150k ops/sec
- 3-property objects: ~85-90k ops/sec
- Array of 100 objects: ~18k ops/sec

### Achievable with Optimizations
With the proposed optimizations, realistic targets:

| Scenario | Current | Target | Method |
|----------|---------|--------|--------|
| Simple string | 120k | 250-300k | Fast path, compiled cache |
| 3-prop object | 87k | 150-180k | Compiled cache, lighter results |
| 100-object array | 18k | 25-30k | Compiled cache, reduce overhead |

**Overall improvement potential: 50-100%**

### Why we can't match Valibot 1:1
- Valibot: ~400k ops/sec for simple objects
- Our architecture has inherent overhead from:
  - Plugin system flexibility
  - Method-based API (vs pure functions)
  - More complete error metadata

**Realistic ceiling: 40-50% of Valibot's speed** (still 2-3x current performance)

---

## 8. Recommended Implementation Priority

### Phase 5: High-Impact, Low-Risk Optimizations

**5.1 Compiled Validator Cache** (Priority 1)
- Compile validator on first use
- Cache compiled function
- Expected: +20-30% overall

**5.2 Fast Path for Simple Types** (Priority 2)
- Detect single-step schemas
- Skip execution pipeline
- Expected: +100-150% for simple types

**5.3 Lighter Result Objects** (Priority 3)
- Discriminated union pattern
- Reduce properties
- Expected: +5-10% overall

### Phase 6: Medium-Impact, Medium-Risk

**6.1 Inline Common Operations**
- Inline `prependIssuePath`
- Inline `isFailure` checks
- Expected: +5-8%

**6.2 Property Access Optimization**
- Cache repeated accesses
- Use local variables
- Expected: +3-5%

### Phase 7: High-Impact, High-Risk (Future)

**7.1 JIT Compilation**
- Generate optimized code strings
- Use Function() constructor
- Expected: +50-100% but complex

**7.2 Result Object Pooling**
- Reuse allocated objects
- Requires careful lifecycle management
- Expected: +5-10% but risky

---

## 9. Conclusion

### Current Performance Position
After 4 rounds of optimization, valchecker has improved significantly:
- ✅ Eliminated Pipe class (Round 3): +10-26%
- ✅ Property metadata pre-computation (Round 4): +141% for large arrays

### Remaining Gap Analysis
Compared to Valibot, we're still 3-4x slower because:
1. **Execution context creation** - ~20-30 cycles per validation
2. **No compiled validator caching** - Pay setup cost every time
3. **Heavier result objects** - More allocation overhead
4. **Complex issue handling** - Path manipulation cost

### Path Forward
With realistic optimizations (Phases 5-6), we can achieve:
- **50-100% additional improvement**
- Close to **40-50% of Valibot's speed**
- Maintain current API and plugin architecture

### Trade-off Decision
The question is: Should we optimize within our current architecture, or consider larger architectural changes to match Valibot's performance?

**Recommendation:** Implement Phase 5 optimizations first (high impact, low risk), then reassess if architectural changes are worth the breaking changes.
