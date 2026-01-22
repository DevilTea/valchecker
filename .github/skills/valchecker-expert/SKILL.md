---
name: valchecker-expert
description: Comprehensive guide for using Valchecker in your projects. Use this skill when implementing validation with valchecker - defining schemas, handling errors, type inference, async validation, and integration patterns.
---

# Valchecker Expert Guide

This skill provides comprehensive guidance for using Valchecker in your projects. Use this when implementing validation schemas, handling validation results, working with type inference, or integrating Valchecker with your application.

## Quick Setup

### Installation

```bash
pnpm add valchecker
# or npm install valchecker
# or yarn add valchecker
```

### Basic Setup

```typescript
import { allSteps, createValchecker } from 'valchecker'

// Development: All steps for convenience
const v = createValchecker({ steps: allSteps })

// Production: Selective imports for smaller bundles
import { createValchecker, string, number, object, array } from 'valchecker'
const v = createValchecker({ steps: [string, number, object, array] })
```

## Core Concepts

### Schemas and Pipelines

Every schema is a pipeline of validation steps:

```typescript
const userSchema = v.object({
  name: v.string()       // Step 1: Validate string
    .toTrimmed()         // Step 2: Trim whitespace
    .min(1),             // Step 3: Validate min length
  email: v.string(),
  age: [v.number().integer().min(0)],  // Optional (wrapped in array)
})
```

### Execution Methods

| Method | Returns | When to Use |
|--------|---------|-------------|
| `run(value)` | `Result` or `Promise<Result>` | Sync pipelines, or when you want auto-detection |
| `execute(value)` | `Promise<Result>` | Always async, consistent handling |

```typescript
// Sync pipeline - run() returns immediately
const result = userSchema.run(data)

// Async pipeline - run() returns Promise
const asyncSchema = v.string().check(async (v) => await checkDb(v))
const result = await asyncSchema.run(data)

// Always async
const result = await userSchema.execute(data)
```

### Result Handling

Results are discriminated unions:

```typescript
const result = schema.run(data)

if (result.isOk) {
  // Success: result.value is fully typed
  console.log(result.value)
} else {
  // Failure: result.issues contains all validation errors
  for (const issue of result.issues) {
    console.log(`[${issue.code}] ${issue.path.join('.')}: ${issue.message}`)
  }
}
```

### Issue Structure

```typescript
interface Issue {
  code: string        // e.g., 'string:expected_string', 'min:expected_min'
  message: string     // Human-readable error message
  path: PropertyKey[] // Location: ['user', 'contacts', 0, 'email']
  payload: unknown    // Issue-specific data
}
```

## Type Inference

### Basic Inference

```typescript
const schema = v.object({
  name: v.string(),
  age: v.number(),
})

type User = v.Infer<typeof schema>
// { name: string; age: number }
```

### Input vs Output Types

```typescript
const schema = v.object({
  name: v.string().toTrimmed(),        // string → string
  tags: v.string().transform(s => s.split(',')),  // string → string[]
})

type Input = v.InferInput<typeof schema>
// { name: string; tags: string }

type Output = v.Infer<typeof schema>
// { name: string; tags: string[] }
```

### Complex Type Inference

```typescript
const schema = v.object({
  id: v.number(),
  status: v.union([v.literal('active'), v.literal('inactive')]),
  tags: [v.array(v.string())],  // Optional
})

type T = v.Infer<typeof schema>
// {
//   id: number
//   status: 'active' | 'inactive'
//   tags: string[] | undefined
// }
```

## Complete Step Reference

### Primitive Steps

| Step | Input | Output | Description |
|------|-------|--------|-------------|
| `string()` | `unknown` | `string` | Validates string type |
| `number()` | `unknown` | `number` | Validates number type |
| `boolean()` | `unknown` | `boolean` | Validates boolean type |
| `bigint()` | `unknown` | `bigint` | Validates bigint type |
| `symbol()` | `unknown` | `symbol` | Validates symbol type |
| `literal(value)` | `unknown` | `typeof value` | Validates exact value |
| `unknown()` | `unknown` | `unknown` | Accepts any value (passthrough) |
| `any()` | `unknown` | `any` | Accepts any value (with `any` type) |
| `never()` | `unknown` | `never` | Always fails |
| `null_()` | `unknown` | `null` | Validates null |
| `undefined_()` | `unknown` | `undefined` | Validates undefined |

### Structure Steps

| Step | Description | Example |
|------|-------------|---------|
| `object(shape)` | Validates object with specific shape | `v.object({ name: v.string() })` |
| `strictObject(shape)` | Validates object, rejects unknown keys | `v.strictObject({ name: v.string() })` |
| `looseObject(shape)` | Alias for `object()`, allows unknown keys | `v.looseObject({ name: v.string() })` |
| `array(schema)` | Validates array with element schema | `v.array(v.number())` |
| `union(schemas)` | First matching schema wins | `v.union([v.string(), v.number()])` |
| `intersection(schemas)` | Merges object schemas | `v.intersection([schemaA, schemaB])` |
| `instance(constructor)` | Validates instance type | `v.instance(Date)` |

### Constraint Steps

| Step | Applies To | Description |
|------|------------|-------------|
| `min(n)` | `number`, `bigint`, `{length}` | Minimum value/length |
| `max(n)` | `number`, `bigint`, `{length}` | Maximum value/length |
| `integer()` | `number` | Integer check |
| `empty()` | `string`, `array` | Must be empty |
| `startsWith(prefix)` | `string` | String must start with prefix |
| `endsWith(suffix)` | `string` | String must end with suffix |

### Transform Steps

| Step | Description | Example |
|------|-------------|---------|
| `transform(fn)` | Custom transformation | `v.string().transform(s => s.length)` |
| `toTrimmed()` | Trim whitespace | `v.string().toTrimmed()` |
| `toTrimmedStart()` | Trim start whitespace | `v.string().toTrimmedStart()` |
| `toTrimmedEnd()` | Trim end whitespace | `v.string().toTrimmedEnd()` |
| `toLowercase()` | Convert to lowercase | `v.string().toLowercase()` |
| `toUppercase()` | Convert to uppercase | `v.string().toUppercase()` |
| `toString()` | Convert to string | `v.number().toString()` |
| `toFiltered(fn)` | Filter array elements | `v.array(v.number()).toFiltered(n => n > 0)` |
| `toSorted(fn?)` | Sort array | `v.array(v.number()).toSorted()` |
| `toSliced(start, end?)` | Slice array | `v.array(v.number()).toSliced(0, 3)` |
| `toSplitted(separator)` | Split string | `v.string().toSplitted(',')` |
| `toLength()` | Get length as number | `v.array(v.string()).toLength()` |
| `parseJSON()` | Parse JSON string | `v.string().parseJSON()` |
| `stringifyJSON()` | Stringify to JSON | `v.object({}).stringifyJSON()` |
| `toAsync()` | Force async execution | `v.string().toAsync()` |
| `json()` | Validate JSON format | `v.string().json()` |

### Flow Control Steps

| Step | Description | Example |
|------|-------------|---------|
| `check(fn, msg?)` | Custom validation | `v.string().check(s => s.includes('@'))` |
| `fallback(fn)` | Provide default on failure | `v.number().min(0).fallback(() => 0)` |
| `use(schema)` | Compose schemas | `v.unknown().use(userSchema)` |
| `as<T>()` | Type assertion | `v.unknown().as<string>()` |
| `generic<T>(factory)` | Recursive schemas | `v.generic<T>(() => schema)` |

## Common Patterns

### Form Validation

```typescript
const loginFormSchema = v.object({
  email: v.string()
    .toTrimmed()
    .toLowercase(),
  password: v.string()
    .min(8),
  rememberMe: [v.boolean().fallback(() => false)],  // Optional with default
})

function validateLoginForm(formData: FormData) {
  const result = loginFormSchema.run({
    email: formData.get('email'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
  })

  if (!result.isOk) {
    // Map issues to form fields
    const errors: Record<string, string> = {}
    for (const issue of result.issues) {
      const field = issue.path[0] as string
      errors[field] = issue.message
    }
    return { success: false, errors }
  }

  return { success: true, data: result.value }
}
```

### API Request Validation

```typescript
const createUserSchema = v.object({
  name: v.string().min(1).max(100),
  email: v.string(),
  role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
})

async function handleCreateUser(req: Request) {
  const body = await req.json()
  const result = createUserSchema.run(body)

  if (!result.isOk) {
    return Response.json({
      error: 'Validation failed',
      issues: result.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    }, { status: 400 })
  }

  const user = await db.users.create(result.value)
  return Response.json(user, { status: 201 })
}
```

### Async Validation with Database

```typescript
const createAccountSchema = v.object({
  username: v.string()
    .toTrimmed()
    .toLowercase()
    .min(3)
    .max(20)
    .check(async (username) => {
      const exists = await db.users.exists({ username })
      return !exists || 'Username already taken'
    }),
  email: v.string()
    .toLowercase()
    .check(async (email) => {
      const exists = await db.users.exists({ email })
      return !exists || 'Email already registered'
    }),
  password: v.string()
    .min(8)
    .check(
      (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw),
      'Password must contain uppercase, lowercase, and number'
    ),
})

// Must use execute() or await run() for async
const result = await createAccountSchema.execute(input)
```

### Nested Object Validation

```typescript
const addressSchema = v.object({
  street: v.string().min(1),
  city: v.string().min(1),
  state: v.string().min(2).max(2),
  zip: v.string(),
  country: v.literal('US'),
})

const companySchema = v.object({
  name: v.string().min(1),
  headquarters: addressSchema,
  branches: [v.array(addressSchema)],  // Optional
})

// Reuse schemas
const orderSchema = v.object({
  id: v.string(),
  company: companySchema,
  shippingAddress: addressSchema,
  billingAddress: [addressSchema],  // Optional
})
```

### Discriminated Unions

```typescript
const paymentSchema = v.union([
  v.object({
    method: v.literal('credit_card'),
    cardNumber: v.string(),
    expiry: v.string(),
    cvv: v.string(),
  }),
  v.object({
    method: v.literal('bank_transfer'),
    accountNumber: v.string(),
    routingNumber: v.string(),
  }),
  v.object({
    method: v.literal('paypal'),
    email: v.string(),
  }),
])

type Payment = v.Infer<typeof paymentSchema>
// Union of all three payment types
```

### Configuration Validation

```typescript
const configSchema = v.object({
  server: v.object({
    host: [v.string().fallback(() => 'localhost')],  // Optional with default
    port: [v.number().integer().min(1).max(65535).fallback(() => 3000)],
    ssl: [v.boolean().fallback(() => false)],
  }),
  database: v.object({
    url: v.string(),
  }),
})

// Load and validate config
const rawConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
const result = configSchema.run(rawConfig)

if (!result.isOk) {
  console.error('Invalid configuration:', result.issues)
  process.exit(1)
}

const config = result.value  // Fully typed with defaults applied
```

### Transformation Pipelines

```typescript
// Parse and validate CSV row
const csvRowSchema = v.string()
  .transform(line => line.split(','))
  .check(arr => arr.length === 4, 'Expected 4 columns')
  .transform(([name, email, age, active]) => ({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    age: parseInt(age, 10),
    active: active.trim().toLowerCase() === 'true',
  }))
  .use(v.object({
    name: v.string().min(1),
    email: v.string(),
    age: v.number().integer().min(0),
    active: v.boolean(),
  }))

const result = csvRowSchema.run('John Doe, john@test.com, 30, true')
// { isOk: true, value: { name: 'John Doe', email: 'john@test.com', age: 30, active: true } }
```

## Custom Messages

### Static Messages

```typescript
const schema = v.object({
  email: v.string().email('Please enter a valid email address'),
  age: v.number()
    .min(18, 'You must be at least 18 years old')
    .max(120, 'Please enter a valid age'),
})
```

### Dynamic Messages

```typescript
const schema = v.number()
  .min(10, ({ payload }) => `Value must be at least 10, got ${payload.value}`)
  .max(100, ({ payload }) => `Value must be at most 100, got ${payload.value}`)
```

### Global Message Handler (i18n)

```typescript
const v = createValchecker({
  steps: allSteps,
  message: ({ code, payload }) => {
    // Use your i18n library
    return i18n.t(`validation.${code}`, payload)
  },
})
```

## Error Handling Best Practices

### Mapping Issues to UI

```typescript
function mapIssuesToFields(issues: Issue[]) {
  const fieldErrors: Map<string, string[]> = new Map()

  for (const issue of issues) {
    const field = issue.path.join('.')
    const existing = fieldErrors.get(field) || []
    fieldErrors.set(field, [...existing, issue.message])
  }

  return fieldErrors
}
```

### Throwing on Validation Failure

```typescript
function parseOrThrow<T>(schema: Schema<T>, data: unknown): T {
  const result = schema.run(data)
  if (!result.isOk) {
    throw new ValidationError(result.issues)
  }
  return result.value
}

class ValidationError extends Error {
  constructor(public issues: Issue[]) {
    super(`Validation failed: ${issues.map(i => i.message).join(', ')}`)
    this.name = 'ValidationError'
  }
}
```

## Standard Schema Compatibility

Valchecker implements Standard Schema V1:

```typescript
import type { StandardSchema } from '@standard-schema/spec'

// Valchecker schemas are Standard Schema compatible
function validateWithStandardSchema<T>(
  schema: StandardSchema<T>,
  input: unknown
): T | null {
  const result = schema['~standard'].validate(input)
  if ('issues' in result) {
    return null
  }
  return result.value
}

// Works with valchecker schemas
const userSchema = v.object({ name: v.string() })
const user = validateWithStandardSchema(userSchema, { name: 'Alice' })
```

## Performance Tips

### Reuse Schemas

```typescript
// ✓ Good: Define once, reuse
const userSchema = v.object({ /* ... */ })

function validateUser(data: unknown) {
  return userSchema.run(data)
}

// ✗ Bad: Creates new schema on every call
function validateUser(data: unknown) {
  const schema = v.object({ /* ... */ })  // Wasteful!
  return schema.run(data)
}
```

### Selective Imports for Production

```typescript
// Analyze which steps you actually use, then import only those
import {
  createValchecker,
  string, number, boolean,
  object, array,
  min, max,
  check, fallback, use,
  toTrimmed, toLowercase,
} from 'valchecker'

const v = createValchecker({
  steps: [
    string, number, boolean,
    object, array,
    min, max,
    check, fallback, use,
    toTrimmed, toLowercase,
  ],
})
```

### Use Sync Execution When Possible

```typescript
// If your schema has no async steps, run() is faster
const syncResult = schema.run(data)  // Immediate result

// execute() always returns a Promise
const asyncResult = await schema.execute(data)  // Extra overhead
```

## Debugging

### Inspecting Issues

```typescript
const result = schema.run(invalidData)

if (!result.isOk) {
  console.log('Validation failed:')
  for (const issue of result.issues) {
    console.log({
      code: issue.code,
      path: issue.path,
      message: issue.message,
      payload: issue.payload,
    })
  }
}
```

### Testing Schemas

```typescript
import { describe, expect, it } from 'vitest'

describe('userSchema', () => {
  it('accepts valid user', () => {
    const result = userSchema.run({
      name: 'Alice',
      email: 'alice@test.com',
    })
    expect(result.isOk).toBe(true)
    if (result.isOk) {
      expect(result.value.name).toBe('Alice')
    }
  })

  it('rejects invalid email', () => {
    const result = userSchema.run({
      name: 'Alice',
      email: 'not-an-email',
    })
    expect(result.isOk).toBe(false)
    if (!result.isOk) {
      expect(result.issues[0].code).toBe('email:expected_email')
      expect(result.issues[0].path).toEqual(['email'])
    }
  })
})
```
