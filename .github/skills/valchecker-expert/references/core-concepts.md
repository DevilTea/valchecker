# Core Concepts

Understanding the fundamental concepts in Valchecker.

## Schemas and Pipelines

A schema is a pipeline of validation steps that process data:

```typescript
const userSchema = v.object({
  name: v.string()        // Step 1: Validate string
    .toTrimmed()          // Step 2: Trim whitespace
    .min(1),              // Step 3: Validate min length
  email: v.string(),
  age: v.number()
    .integer()            // Constraint
    .min(0)               // Constraint
    .max(150),            // Constraint
})
```

Each step processes the value and can either:
- **Pass** the value to the next step
- **Transform** the value before passing it
- **Fail** and stop the pipeline

## Execution: run() vs execute()

| Method | Returns | When to Use |
|--------|---------|-------------|
| `run(value)` | Result or Promise<Result> | Auto-detects async/sync |
| `execute(value)` | Promise<Result> | Always async |

### Synchronous Pipeline

```typescript
const schema = v.string().toTrimmed()
const result = schema.run('  hello  ')
// result is synchronous: { value: 'hello' }
```

### Asynchronous Pipeline

```typescript
const schema = v.string().check(async (value) => {
  return await checkDatabase(value)
})
const result = await schema.run('hello')
// result is returned from Promise
```

### Always Async

```typescript
const result = await userSchema.execute(data)
// Consistent async handling regardless of steps
```

## Result Handling

Results are discriminated unions with `value` or `issues` discriminator:

```typescript
const result = schema.run(data)

if ('value' in result) {
  // Success branch
  console.log(result.value)  // Your validated data
  console.log(result.issues) // undefined
} else {
  // Failure branch
  console.log(result.value)  // undefined
  console.log(result.issues) // Array<Issue>
}
```

## Issue Structure

Each validation error has this structure:

```typescript
interface Issue {
  code: string           // e.g., 'string:expected_string'
  message: string        // Human-readable message
  path: PropertyKey[]    // Location: ['user', 'address', 0, 'zipcode']
  payload: unknown       // Issue-specific data for custom messages
}
```

### Issue Codes

Format: `[step-name]:[description]`

Examples:
- `string:expected_string` - Expected a string value
- `number:expected_number` - Expected a number value
- `min:expected_min` - Value below minimum
- `max:expected_max` - Value above maximum
- `object:unexpected_keys` - Object has unexpected properties

### Issue Paths

Paths indicate where in nested structures the error occurred:

```typescript
const schema = v.object({
  users: v.array(v.object({
    email: v.string(),
  })),
})

const result = schema.run({
  users: [
    { email: 'alice@example.com' },
    { email: 123 },  // Error here!
  ],
})

if ('issues' in result) {
  result.issues[0].path
  // ['users', 1, 'email']
  //  object  array string
  //          index  field
}
```

## Optional Fields

Use array syntax `[schema]` for optional fields:

```typescript
const userSchema = v.object({
  name: v.string(),           // Required
  nickname: [v.string()],     // Optional - string | undefined
  tags: [v.array(v.string())], // Optional - string[] | undefined
})

// Both valid:
userSchema.run({ name: 'Alice' })
userSchema.run({ name: 'Alice', nickname: 'Ali' })
```

## Custom Error Messages

Provide custom messages for better UX:

```typescript
const schema = v.string()
  .min(5, 'Username must be at least 5 characters')

const result = schema.run('ab')
if ('issues' in result) {
  console.log(result.issues[0].message)
  // 'Username must be at least 5 characters'
}
```

### Message Functions

Use functions for dynamic messages:

```typescript
const schema = v.number()
  .min(0, ({ payload }) => `Expected positive, got ${payload.value}`)

const result = schema.run(-5)
if ('issues' in result) {
  console.log(result.issues[0].message)
  // 'Expected positive, got -5'
}
```

## Step Chaining

Steps chain together, each passing to the next:

```typescript
v.string()
  .toTrimmed()        // Transforms: '  hello  ' → 'hello'
  .toLowercase()      // Transforms: 'Hello' → 'hello'
  .min(1)             // Constraint: validates length
  .check(v => v !== 'admin')  // Custom: validates value
```

## Input vs Output

Transforms change what data type leaves the schema:

```typescript
const schema = v.string()
  .toFiltered(c => c !== 'a')  // string → string (filtered)

type Input = v.InferInput<typeof schema>   // string
type Output = v.Infer<typeof schema>       // string
```

### More Complex Example

```typescript
const schema = v.string()
  .toSplitted(',')           // string → string[]
  .transform(arr => arr.length)  // string[] → number

type Input = v.InferInput<typeof schema>   // string
type Output = v.Infer<typeof schema>       // number
```

## Composition

Schemas can be composed into larger schemas:

```typescript
const addressSchema = v.object({
  street: v.string(),
  city: v.string(),
})

const userSchema = v.object({
  name: v.string(),
  address: addressSchema,  // Reuse schema
})
```

## Next Steps

- Learn [type inference](./type-inference.md) details
- See [common patterns](./patterns.md)
- Understand [error handling](./error-handling.md) techniques
