# Type Inference Guide

Valchecker automatically infers TypeScript types from your schemas for complete type safety.

## Basic Type Inference

### Output Type

Extract the validated output type from any schema:

```typescript
import { InferOutput } from 'valchecker'

const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.string(),
})

type User = InferOutput<typeof userSchema>
// { name: string; age: number; email: string }
```

### Input Type

Get the input type that the schema expects:

```typescript
import { InferInput } from 'valchecker'

type UserInput = InferInput<typeof userSchema>
```

## Optional Fields

Fields wrapped in array brackets become optional:

```typescript
const schema = v.object({
  name: v.string(),          // Required
  nickname: [v.string()],    // Optional (?)
  tags: [v.array(v.string())], // Optional
})

type Result = InferOutput<typeof schema>
// {
//   name: string
//   nickname?: string
//   tags?: string[]
// }
```

## Transform Types

Transforms affect the output type:

```typescript
const schema = v.string()
  .toUppercase()
  .toLowercase()

type Result = InferOutput<typeof schema>
// string (always string after transforms)
```

### Object Transforms

Transform step outputs affect nested types:

```typescript
const schema = v.object({
  name: v.string().toTrimmed(),
  data: v.string().parseJSON(),
})

type Result = InferOutput<typeof schema>
// {
//   name: string
//   data: unknown
// }
```

## Complex Structures

### Arrays

```typescript
const schema = v.array(
  v.object({
    id: v.number(),
    title: v.string(),
  })
)

type Result = InferOutput<typeof schema>
// Array<{ id: number; title: string }>
```

### Unions

```typescript
const schema = v.union([
  v.object({ type: v.literal('user'), name: v.string() }),
  v.object({ type: v.literal('admin'), permissions: v.array(v.string()) }),
])

type Result = InferOutput<typeof schema>
// { type: 'user'; name: string } | { type: 'admin'; permissions: string[] }
```

### Nested Objects

```typescript
const addressSchema = v.object({
  street: v.string(),
  city: v.string(),
})

const userSchema = v.object({
  name: v.string(),
  address: addressSchema,
})

type User = InferOutput<typeof userSchema>
// {
//   name: string
//   address: { street: string; city: string }
// }
```

## Type Narrowing

Schemas perform type narrowing:

```typescript
const input: unknown = getUserInput()

const schema = v.string().min(1)
const result = schema.execute(input)

if ('value' in result) {
  // result.value is now typed as string
  console.log(result.value.toUpperCase())
} else {
  // result.issues contains validation errors
  console.log(result.issues)
}
```

## Discriminated Unions

Result is a discriminated union based on validation success:

```typescript
const result = schema.execute(data)

if ('value' in result) {
  // Success branch
  type SuccessResult = typeof result
  // { value: T; issues?: never }
} else {
  // Failure branch
  type FailureResult = typeof result
  // { issues: Issue[]; value?: never }
}
```

## Custom Type Guards

Create reusable schemas with predictable types:

```typescript
const emailSchema = v.string()
  .toTrimmed()
  .toLowercase()
  .check(s => s.includes('@'))

type Email = InferOutput<typeof emailSchema>

const userSchema = v.object({
  email: emailSchema,
  backup: [emailSchema],
})

type User = InferOutput<typeof userSchema>
// { email: string; backup?: string }
```

## Async Schemas

Async steps don't affect the output type:

```typescript
const schema = v.string()
  .check(async (val) => {
    const exists = await checkExists(val)
    return exists
  })

type Result = InferOutput<typeof schema>
// string (not Promise<string>)

// But execution must be awaited
const result = await schema.execute(data)
```

## Function Schemas

Use `use()` step for complex transformations:

```typescript
const schema = v.string().use((val) => ({
  original: val,
  upper: val.toUpperCase(),
}))

type Result = InferOutput<typeof schema>
// { original: string; upper: string }
```

## Tips for Type Inference

1. **Keep types explicit** - Use `InferOutput<typeof schema>` for clarity
2. **Compose schemas** - Build small schemas and combine them
3. **Use optional arrays** - `[v.string()]` for optional fields
4. **Trust the inference** - Valchecker maintains type safety through the pipeline
5. **Check discriminated unions** - Always use `'value' in result` pattern for type guards
