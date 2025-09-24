# Core API Reference

This section documents the core functions, classes, and types provided by valchecker.

## Functions

### `execute(schema, value)`

Executes a schema against an input value, returning a validation result.

```typescript
function execute<Schema extends ValSchema>(
  schema: Schema,
  value: InferInput<Schema>
): InferExecuteReturn<Schema>
```

**Parameters:**
- `schema`: The schema to execute
- `value`: The input value to validate

**Returns:** `ExecutionResult<Output>` - Either a success with the validated value or a failure with issues

**Example:**
```typescript
const schema = v.string()
const result = v.execute(schema, 'hello')

if (v.isSuccess(result)) {
  console.log(result.value) // 'hello'
}
```

### `isValid(schema, value)`

Checks if a value passes validation without returning the validated value.

```typescript
function isValid<Schema extends ValSchema>(
  schema: Schema,
  value: InferInput<Schema>
): InferIsValidReturn<Schema>
```

**Parameters:**
- `schema`: The schema to check against
- `value`: The input value to validate

**Returns:** `boolean` (sync) or `Promise<boolean>` (async)

**Example:**
```typescript
const isValidString = v.isValid(v.string(), 'hello') // true
const isValidNumber = v.isValid(v.number(), 'not a number') // false
```

### `isSuccess(result)`

Type guard that checks if an execution result is successful.

```typescript
function isSuccess<Output>(
  result: ExecutionResult<Output>
): result is ExecutionSuccessResult<Output>
```

**Parameters:**
- `result`: The execution result to check

**Returns:** `boolean` - True if the result is a success

**Example:**
```typescript
const result = v.execute(v.string(), 'test')
if (v.isSuccess(result)) {
  // result.value is available here
  console.log(result.value.toUpperCase())
}
```

## Classes

### `AbstractSchema`

Base class for all valchecker schemas. You typically won't instantiate this directly, but all schemas extend from it.

```typescript
abstract class AbstractSchema<T extends SchemaTypes = any> {
  constructor(payload?: { meta?: T['meta']; message?: SchemaMessage<T> })

  readonly meta: T['meta']
  readonly '~standard': StandardProps<T>
  readonly isTransformed: boolean

  execute(value: T['input']): MaybePromise<ExecutionResult<T['output']>>
}
```

**Properties:**
- `meta`: Custom metadata associated with the schema
- `~standard`: StandardSchemaV1 compliance properties
- `isTransformed`: Whether this schema transforms input data

**Methods:**
- `execute(value)`: Execute validation (same as the standalone `execute` function)

## Types

### `ValSchema`

The main schema type that all valchecker schemas implement.

```typescript
type ValSchema<Props extends RawSchemaTypesParam = any> = AbstractSchema<{
  async: boolean
  transformed: boolean
  meta: any
  input: any
  output: any
  issueCode: string
}>
```

### `ExecutionResult`

Union type representing the result of schema execution.

```typescript
type ExecutionResult<Output> =
  | ExecutionSuccessResult<Output>
  | ExecutionFailureResult
```

### `ExecutionSuccessResult`

Result when validation succeeds.

```typescript
interface ExecutionSuccessResult<Output> {
  value: Output
}
```

### `ExecutionFailureResult`

Result when validation fails.

```typescript
interface ExecutionFailureResult {
  issues: ExecutionIssue[]
}
```

### `ExecutionIssue`

Represents a single validation error.

```typescript
interface ExecutionIssue {
  readonly code: string
  readonly message: string
  readonly path?: PropertyKey[]
  readonly error?: unknown
}
```

## Type Inference Utilities

### `InferInput<Schema>`

Extracts the input type from a schema.

```typescript
type InputType = v.InferInput<typeof mySchema>
```

### `InferOutput<Schema>`

Extracts the output type from a schema.

```typescript
type OutputType = v.InferOutput<typeof mySchema>
```

### `InferAsync<Schema>`

Extracts whether a schema supports async operations.

```typescript
type IsAsync = v.InferAsync<typeof mySchema> // true or false
```

### `InferExecuteReturn<Schema>`

Gets the return type of `execute()` for a schema.

```typescript
type ExecuteReturn = v.InferExecuteReturn<typeof mySchema>
// ExecutionResult<Output> or Promise<ExecutionResult<Output>>
```

### `InferIsValidReturn<Schema>`

Gets the return type of `isValid()` for a schema.

```typescript
type IsValidReturn = v.InferIsValidReturn<typeof mySchema>
// boolean or Promise<boolean>
```

## Schema Types

### `SchemaTypes`

Core type parameters that define a schema's behavior.

```typescript
interface SchemaTypes {
  readonly async: boolean
  readonly transformed: boolean
  readonly meta: any
  readonly input: any
  readonly output: any
  readonly issueCode: string
}
```

### `SchemaMessage`

Type for custom error messages.

```typescript
type SchemaMessage<T extends SchemaTypes> = // Complex type for message functions
```

## Advanced Types

### `DefineSchemaTypes`

Helper for defining custom schema types.

```typescript
type DefineSchemaTypes<P extends RawSchemaTypesParam> = // Implementation details
```

These types are primarily used when creating custom schemas or extending valchecker.

## Next Section

- [Schema Constructors](./api-schemas.md) - Built-in schema types
- [Pipe Operations](./api-pipe.md) - Advanced validation chains