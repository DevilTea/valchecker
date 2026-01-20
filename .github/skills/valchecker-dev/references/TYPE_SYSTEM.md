# Type System Deep Dive

## Type Inference Architecture

Valchecker uses advanced TypeScript techniques to provide complete type inference without any type annotations needed from users.

## Core Types

### ExecutionResult

All validations return `ExecutionResult`:

```typescript
type ExecutionResult<Output = unknown, Issue extends ExecutionIssue = ExecutionIssue> =
  | ExecutionSuccessResult<Output>
  | ExecutionFailureResult<Issue>

interface ExecutionSuccessResult<Output> extends StandardSchemaV1.SuccessResult<Output> {
  value: Output
}

interface ExecutionFailureResult<Issue> extends StandardSchemaV1.FailureResult {
  issues: Issue[]
}
```

### ExecutionIssue

Error details include context:

```typescript
interface ExecutionIssue<
  IssueCode extends string = (string & {}),
  IssuePayload = unknown,
> extends StandardSchemaV1.Issue {
  code: IssueCode
  payload: IssuePayload
  message: string
  path: PropertyKey[]
}
```

### TValchecker

Central type that tracks the validator state:

```typescript
interface TValchecker {
  '~core': {
    executionStepContext: TExecutionContext
    registeredExecutionStepPlugins: TStepPluginDef
  }
}
```

The `~core` property:
- Stores execution context
- Tracks registered plugins
- Enables type reflection

## Type Evolution Through Pipeline

### Initial State

When you create a valchecker instance:

```typescript
const v = createValchecker({ steps: allSteps })
```

The type is `InitialValchecker` - a union of all possible steps.

### Step-by-Step Evolution

```typescript
// Step 1: Create schema
const schema = v.string()
// Type is now narrowed to: Valchecker<string, StringIssue>

// Step 2: Add transformation
const schema2 = schema.toUppercase()
// Type remains: Valchecker<string, StringIssue>

// Step 3: Add constraint
const schema3 = schema2.min(5)
// Type remains: Valchecker<string, StringIssue | MinIssue>

// Step 4: Add custom transformation
const schema4 = schema3.transform(s => s + '!')
// Type transforms to: Valchecker<string, StringIssue | MinIssue | TransformIssue>

// Step 5: Execute
const result = schema4.execute('HELLO!')
// Result type: ExecutionResult<string, StringIssue | MinIssue | ...>
```

## Advanced Type Techniques

### 1. Conditional Types

Used to select types based on conditions:

```typescript
type InferOutput<T> = T extends Valchecker<infer U>
  ? U
  : T extends { execute(value: any): any }
    ? ReturnType<T['execute']>
    : unknown
```

### 2. Mapped Types

Used to transform type properties:

```typescript
type InferAllIssues<T> = T extends Valchecker<any, infer Issue>
  ? Issue
  : never

type KeysWithIssues<T> = {
  [K in keyof T]: T[K] extends Valchecker<any, infer Issue>
    ? Issue
    : never
}
```

### 3. Type Overloads

Methods have multiple signatures for different inputs:

```typescript
// Transform overload
interface Valchecker {
  transform<U>(fn: (v: T) => U): Valchecker<U, ...>
  transform<U>(fn: (v: T) => Promise<U>): Valchecker<U, ...>
}
```

### 4. Generic Constraints

Restrict what types can be used:

```typescript
interface ObjectStep<T extends Record<string, any>> {
  // T must be a record type
}

interface ArrayStep<T extends any[]> {
  // T must be an array type
}
```

## Object Schema Type Inference

### Object Property Resolution

```typescript
const schema = v.object({
  name: v.string(),
  age: v.number(),
  email: [v.string()],  // Optional: wrapped in array
})
```

**Type inference**:
- `name: string` - Required, inferred from step
- `age: number` - Required, inferred from step
- `email?: string` - Optional (wrapped in array)

**Resulting type**:
```typescript
{
  name: string
  age: number
  email?: string
}
```

### Optional Properties

Array-wrapped schemas become optional:

```typescript
v.object({
  required: v.string(),     // Required
  optional: [v.number()],   // Optional
})
```

## Union and Intersection Types

### Union Type Inference

```typescript
const schema = v.union([
  v.string(),
  v.number(),
])
```

**Resulting type**: `string | number`

### Intersection Type Inference

```typescript
const schema = v.intersection([
  v.object({ name: v.string() }),
  v.object({ age: v.number() }),
])
```

**Resulting type**: `{ name: string; age: number }`

## Transform Type Changes

### Transform with Type Narrowing

```typescript
const schema = v.unknown()
  .transform(x => {
    if (typeof x === 'string') return x
    throw new Error('Not a string')
  })
```

**Type narrowing**: The output type becomes `string`.

### Transform with Type Widening

```typescript
const schema = v.string()
  .transform(s => ({
    value: s,
    length: s.length
  }))
```

**Type widening**: Output type becomes `{ value: string; length: number }`.

## Issue Type Accumulation

### Issue Union

As steps add validations, issue types accumulate:

```typescript
const schema = v.string()
  .check(() => true, 'Check failed')
  .min(5, 'Min length 5')
  .max(10, 'Max length 10')
```

**Issue union includes**:
- `StringIssue`
- `CheckIssue`
- `MinIssue`
- `MaxIssue`

### Type Guard Usage

```typescript
const result = schema.execute(value)

if (v.isSuccess(result)) {
  // TypeScript knows result.value is string
  const str: string = result.value
}

if (v.isFailure(result)) {
  // TypeScript knows result.issues is Issue[]
  const issues: ExecutionIssue[] = result.issues
}
```

## Generic Schemas

### Generic Definition

```typescript
const createPageSchema = <T extends Record<string, any>>(
  itemSchema: Valchecker<T>
) => {
  return v.object({
    items: v.array(itemSchema),
    total: v.number(),
  })
}
```

### Generic Usage

```typescript
const userSchema = v.object({
  id: v.string(),
  name: v.string(),
})

const pageSchema = createPageSchema(userSchema)
// Type inference:
// { items: User[], total: number }
```

## Type Safety at Boundaries

### Runtime Type Guards

```typescript
function processResult(result: ExecutionResult<any>) {
  if (v.isSuccess(result)) {
    // Type is ExecutionSuccessResult<T>
    process(result.value)
  } else {
    // Type is ExecutionFailureResult<Issue>
    handleErrors(result.issues)
  }
}
```

### Exhaustiveness Checking

```typescript
const result = schema.execute(value)

// This catches if you forget a case:
const processed: string = (() => {
  if (v.isSuccess(result)) {
    return result.value
  } else {
    return 'error' // Missing some case?
  }
})()
```

## Performance Implications

### Type Computation

TypeScript's type system is computed at:
- **Definition time** - When creating schemas
- **Compile time** - When checking types
- **Not runtime** - Types are erased

### Optimization Strategies

1. **Reuse schemas** - Define once, use many times
2. **Cache inferred types** - Use `type` aliases
3. **Limit nesting** - Deep nesting increases computation
4. **Use constraints** - Bounded types compute faster

## Type Debugging

### Check Inferred Type

```typescript
// Hover in IDE to see type
const schema = v.string().min(5)

// Or use a type assertion to verify
const _: Valchecker<string> = schema
```

### Type Error Messages

When type checking fails:

```bash
pnpm typecheck
```

Provides detailed error locations.

### Verify with Tests

```typescript
import { expectType } from 'vitest'

it('should infer correct type', () => {
  const schema = v.string()
  expectType<Valchecker<string>>(schema)
})
```

## Type Limitations

### Known Constraints

1. **Recursive types** - Cannot fully infer infinitely nested structures
2. **Conditional logic** - Type narrowing requires explicit paths
3. **Runtime value effects** - Types can't capture runtime values

### Workarounds

1. **Manual annotation** - Type tricky structures explicitly
2. **Helper functions** - Extract complex type logic
3. **Tests** - Verify types with type assertions

---

See PLUGIN_SYSTEM.md for how types interact with plugins.
