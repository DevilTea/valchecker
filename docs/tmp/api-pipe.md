# Pipe Operations API Reference

Pipe operations allow you to chain validation, transformation, and error recovery operations on schemas. All pipe operations are available through the `v.pipe(baseSchema)` constructor.

## Overview

```typescript
const schema = v.pipe(v.string())
  .check(value => value.length > 3, 'Too short')
  .transform(value => value.toUpperCase())
  .fallback(() => 'DEFAULT')
```

## Methods

### `check(predicate, message?, options?)`

Adds a validation check to the pipe. The predicate can be sync or async.

```typescript
.check(
  predicate: (value: Input, utils: CheckUtils) => MaybePromise<boolean | NarrowResult>,
  message?: string,
  options?: { path?: PropertyKey[] }
): PipeSchema
```

**Parameters:**
- `predicate`: Function that returns `true` for valid values, `false` or throws for invalid
- `message`: Custom error message for validation failures
- `options.path`: Path to prepend to error locations

**CheckUtils:**
```typescript
interface CheckUtils {
  narrow<T>(): asserts value is T  // Type narrowing utility
}
```

**Examples:**

```typescript
// Simple validation
const emailSchema = v.pipe(v.string())
  .check(value => value.includes('@'), 'Must contain @')

// Type narrowing
const startsWithSchema = v.pipe(v.string())
  .check(
    (value, { narrow }) => value.startsWith('prefix_') ? narrow<`prefix_${string}`>() : false,
    'Must start with prefix_'
  )

// Type guard
const lengthSchema = v.pipe(v.string())
  .check((value): value is string => value.length > 5, 'Too short')

// Async validation
const asyncSchema = v.pipe(v.string())
  .check(async value => {
    await someAsyncCheck(value)
    return true
  }, 'Async validation failed')
```

### `transform(transformer)`

Transforms the validated value. The transformer can be sync or async.

```typescript
.transform<Output>(
  transformer: (value: Input) => MaybePromise<Output>
): PipeSchema
```

**Parameters:**
- `transformer`: Function that transforms the input value to a new output

**Type Changes:** Changes the pipe's output type to the transformer's return type.

**Examples:**

```typescript
// Simple transformation
const upperSchema = v.pipe(v.string())
  .transform(value => value.toUpperCase())

// Object transformation
const userSchema = v.pipe(v.object({ name: v.string(), age: v.number() }))
  .transform(user => ({ ...user, fullName: user.name.toUpperCase() }))

// Async transformation
const asyncTransformSchema = v.pipe(v.string())
  .transform(async value => {
    const processed = await someAsyncProcess(value)
    return processed
  })
```

### `fallback(fallbackFn)`

Provides a fallback value when validation fails. The fallback can be sync or async.

```typescript
.fallback(
  fallbackFn: (issues: ExecutionIssue[]) => MaybePromise<Output>
): PipeSchema
```

**Parameters:**
- `fallbackFn`: Function that receives validation issues and returns a fallback value

**Behavior:** When any previous step in the pipe fails, `fallback` is called instead of returning the failure.

**Examples:**

```typescript
// Simple fallback
const robustNumberSchema = v.pipe(v.number())
  .check(value => value >= 0, 'Must be non-negative')
  .fallback(() => 0)

// Fallback with logging
const loggedFallbackSchema = v.pipe(v.string())
  .check(value => value.length > 0, 'Cannot be empty')
  .fallback(issues => {
    console.warn('Validation failed:', issues)
    return 'DEFAULT_VALUE'
  })

// Async fallback
const asyncFallbackSchema = v.pipe(v.number())
  .fallback(async issues => {
    // Fetch default from database
    return await getDefaultValue()
  })
```

### `run(schema)`

Chains another schema to run after the current pipe operations succeed.

```typescript
.run<NextSchema extends ValSchema>(
  schema: NextSchema
): PipeSchema
```

**Parameters:**
- `schema`: Another schema to execute with the current pipe's output

**Behavior:** If the pipe succeeds, runs the provided schema on the result.

**Examples:**

```typescript
// Chain schemas
const enhancedStringSchema = v.pipe(v.string())
  .run(v.pipe(v.string()).check(value => value.length > 0))

// Complex chaining
const processedUserSchema = v.pipe(v.object({ name: v.string() }))
  .transform(user => user.name)
  .run(v.pipe(v.string()).transform(name => ({ processedName: name.toUpperCase() })))
```

## Pipe Schema Type

All pipe operations return a `PipeSchema` which extends `ValSchema` with additional methods.

```typescript
interface PipeSchema<T extends ValSchema> extends ValSchema {
  check(...): PipeSchema
  transform<Output>(...): PipeSchema
  fallback(...): PipeSchema
  run<Next>(...): PipeSchema
}
```

## Execution Order

Pipe operations execute in the order they are chained:

1. Base schema validation
2. `check()` operations (in order)
3. `transform()` operations (in order)
4. If any step fails and `fallback()` is present, execute fallback
5. If successful, execute `run()` schema

## Error Handling

- **Checks:** Failures in `check()` create issues with the provided message
- **Transforms:** Exceptions in `transform()` create `'UNKNOWN_ERROR'` issues
- **Fallbacks:** Fallback functions can throw, which creates `'UNKNOWN_ERROR'` issues
- **Runs:** Failures in `run()` schemas propagate normally

## Type Inference

Pipe operations maintain full TypeScript inference:

```typescript
const schema = v.pipe(v.string())
  .check(value => value.length > 3, 'Too short')
  .transform(value => value.toUpperCase())
  .fallback(() => 'DEFAULT')

// Types:
// Input: string
// Output: string (from transform) | 'DEFAULT' (from fallback)
```

## Advanced Patterns

### Conditional Transformation

```typescript
const conditionalSchema = v.pipe(v.object({ type: v.string(), value: v.unknown() }))
  .check(obj => {
    if (obj.type === 'number') {
      return typeof obj.value === 'number'
    }
    return true
  }, 'Invalid value for type')
  .transform(obj => {
    if (obj.type === 'number') {
      return { ...obj, processedValue: (obj.value as number) * 2 }
    }
    return obj
  })
```

### Error Recovery Chains

```typescript
const robustSchema = v.pipe(v.string())
  .transform(value => parseInt(value))  // May throw
  .fallback(() => 0)                     // Recover with default
  .check(value => value >= 0, 'Must be non-negative')
  .fallback(() => 1)                     // Another fallback
```

### Async Pipelines

```typescript
const asyncPipeline = v.pipe(v.string())
  .check(async value => {
    const result = await externalValidation(value)
    return result.isValid
  }, 'External validation failed')
  .transform(async value => {
    const enriched = await enrichData(value)
    return enriched
  })
  .fallback(async issues => {
    await logErrors(issues)
    return getDefaultData()
  })
```

## Performance Considerations

- Pipe operations are executed sequentially
- Async operations in pipes make the entire schema async
- Use `run()` for complex chaining to keep types clean
- Fallbacks only execute on failure, so they're efficient for success cases

## Next Section

- [Examples](./examples.md) - Comprehensive pipe usage examples
- [Advanced Topics](./advanced.md) - Custom schemas and patterns