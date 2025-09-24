# Core Concepts

This section explains the fundamental concepts behind valchecker and how they work together to provide type-safe data validation.

## Schemas and Types

At the heart of valchecker are **schemas** - objects that define validation rules and type transformations. Every schema implements the `ValSchema` interface and extends `AbstractSchema`.

### Schema Types

Schemas have several type parameters that define their behavior:

```typescript
interface SchemaTypes {
  readonly async: boolean        // Whether validation can be async
  readonly transformed: boolean  // Whether the schema transforms data
  readonly meta: any            // Custom metadata
  readonly input: any           // Input type
  readonly output: any          // Output type (may differ from input if transformed)
  readonly issueCode: string    // Type of validation error codes
}
```

### Creating Schemas

Valchecker provides built-in schema constructors for common types:

```typescript
import * as v from 'valchecker'

// Primitive schemas
const strSchema = v.string()     // Validates strings
const numSchema = v.number()     // Validates numbers
const boolSchema = v.boolean()   // Validates booleans

// Complex schemas
const arrSchema = v.array(v.string())  // Array of strings
const objSchema = v.object({
  name: v.string(),
  age: v.number()
})
```

## Execution and Results

Schema validation is performed using the `execute()` function, which returns an `ExecutionResult`.

### Execution Results

There are two types of execution results:

```typescript
// Success result
interface ExecutionSuccessResult<Output> {
  value: Output  // The validated/transformed value
}

// Failure result
interface ExecutionFailureResult {
  issues: ExecutionIssue[]  // Array of validation errors
}

// Union type
type ExecutionResult<Output> = ExecutionSuccessResult<Output> | ExecutionFailureResult
```

### Execution Issues

When validation fails, you get detailed error information:

```typescript
interface ExecutionIssue {
  readonly code: string        // Error code (e.g., 'EXPECTED_STRING')
  readonly message: string     // Human-readable error message
  readonly path?: PropertyKey[] // Path to the invalid field (for nested objects)
  readonly error?: unknown     // Original error if validation threw
}
```

## Success/Failure Handling

Valchecker provides utilities to check result types and handle them safely.

### Checking Results

```typescript
import * as v from 'valchecker'

const schema = v.string()
const result = v.execute(schema, 123) // Invalid input

// Check if successful
if (v.isSuccess(result)) {
  console.log('Valid:', result.value)  // result.value is typed as string
} else {
  console.log('Invalid:', result.issues)  // result.issues contains errors
}
```

### Type Guards

The `isSuccess()` function is a type guard that narrows the result type:

```typescript
function processResult<T>(result: v.ExecutionResult<T>): T {
  if (v.isSuccess(result)) {
    // TypeScript knows result.value exists and is of type T
    return result.value
  } else {
    // TypeScript knows result.issues exists
    throw new Error(`Validation failed: ${result.issues.map(i => i.message).join(', ')}`)
  }
}
```

## Async Validation

Valchecker supports asynchronous validation and transformation out of the box.

### Async Execution

```typescript
const asyncSchema = v.pipe(v.string())
  .check(async (value) => {
    // Simulate async validation (e.g., database check)
    await new Promise(resolve => setTimeout(resolve, 100))
    return value.length > 3
  }, 'String too short')

// Execution returns a Promise
const result = await v.execute(asyncSchema, 'test')
```

### Async Type Inference

Schemas automatically infer async behavior:

```typescript
// Sync schema
const syncSchema = v.string()
// v.InferAsync<typeof syncSchema> = false

// Async schema
const asyncSchema = v.pipe(v.string())
  .check(async () => true, 'async check')
// v.InferAsync<typeof asyncSchema> = true
```

## Type Inference

Valchecker provides comprehensive TypeScript type inference utilities.

### Inferring Types

```typescript
import * as v from 'valchecker'

const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  tags: v.array(v.string())
})

// Infer input type (what you pass to execute)
type UserInput = v.InferInput<typeof userSchema>
// { name: string; age: number; tags: string[] }

// Infer output type (what you get back)
type UserOutput = v.InferOutput<typeof userSchema>
// Same as input for non-transformed schemas

// Infer async behavior
type IsAsync = v.InferAsync<typeof userSchema> // false or true
```

### Transformed Schemas

When using transformations, input and output types can differ:

```typescript
const transformedSchema = v.pipe(v.object({ name: v.string() }))
  .transform(user => ({ ...user, id: Date.now() }))

type Input = v.InferInput<typeof transformedSchema>
// { name: string }

type Output = v.InferOutput<typeof transformedSchema>
// { name: string; id: number }
```

## Schema Composition

Schemas can be composed to build complex validation rules:

### Object Composition

```typescript
const addressSchema = v.object({
  street: v.string(),
  city: v.string(),
  zipCode: v.string()
})

const userSchema = v.object({
  name: v.string(),
  email: v.string(),
  address: addressSchema  // Nested schema
})
```

### Union Types

```typescript
const stringOrNumber = v.union(v.string(), v.number())
// Accepts either string or number
```

### Optional Fields

```typescript
const partialUser = v.object({
  name: v.string(),
  age: v.optional(v.number())  // May be undefined
})
```

## Next Steps

- [API Reference](./api-core.md) - Detailed function documentation
- [Pipe Operations](./api-pipe.md) - Advanced validation with pipes
- [Examples](./examples.md) - Practical usage patterns