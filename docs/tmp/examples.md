# Examples

This section provides comprehensive examples of using valchecker for various validation scenarios. All examples are based on real usage patterns and can be adapted for your needs.

## Basic Schema Validation

### String Validation

```typescript
import * as v from 'valchecker'

const stringSchema = v.string()

// Valid string
const result1 = v.execute(stringSchema, 'hello world')
console.log(v.isSuccess(result1)) // true
if (v.isSuccess(result1)) {
  console.log(result1.value) // 'hello world'
}

// Invalid input (number)
const result2 = v.execute(stringSchema, 123)
console.log(v.isSuccess(result2)) // false
if (!v.isSuccess(result2)) {
  console.log(result2.issues[0].code) // 'EXPECTED_STRING'
}
```

### Number Validation

```typescript
const numberSchema = v.number()

// Valid number
const result1 = v.execute(numberSchema, 42)
console.log(v.isSuccess(result1)) // true

// NaN handling
const result2 = v.execute(numberSchema, Number.NaN)
console.log(v.isSuccess(result2)) // false (NaN not allowed by default)

// Allow NaN
const numberWithNaNSchema = v.number(true)
const result3 = v.execute(numberWithNaNSchema, Number.NaN)
console.log(v.isSuccess(result3)) // true
```

### Boolean Validation

```typescript
const booleanSchema = v.boolean()

const result1 = v.execute(booleanSchema, true)   // true
const result2 = v.execute(booleanSchema, false)  // true
const result3 = v.execute(booleanSchema, 'true') // false - EXPECTED_BOOLEAN
```

## Complex Schemas

### Object Validation

```typescript
const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  isActive: v.boolean(),
})

const validUser = {
  name: 'John Doe',
  age: 30,
  isActive: true,
}

const result = v.execute(userSchema, validUser)
if (v.isSuccess(result)) {
  console.log('User validated:', result.value)
  // TypeScript knows result.value has type: { name: string; age: number; isActive: boolean }
}
```

### Array Validation

```typescript
const stringArraySchema = v.array(v.string())

const result1 = v.execute(stringArraySchema, ['a', 'b', 'c'])  // true
const result2 = v.execute(stringArraySchema, ['a', 1, 'c'])    // false - mixed types
const result3 = v.execute(stringArraySchema, 'not an array')   // false - not an array
```

### Union Types

```typescript
const stringOrNumberSchema = v.union(v.string(), v.number())

const result1 = v.execute(stringOrNumberSchema, 'hello') // true
const result2 = v.execute(stringOrNumberSchema, 42)      // true
const result3 = v.execute(stringOrNumberSchema, true)    // false
```

### Optional Fields

```typescript
const optionalUserSchema = v.object({
  name: v.string(),
  age: v.optional(v.number()),
  email: v.optional(v.string()),
})

const user1 = { name: 'John' }                          // valid
const user2 = { name: 'John', age: 25 }                 // valid
const user3 = { name: 'John', age: undefined }          // valid
const user4 = { name: 'John', age: 'twenty-five' }      // invalid - age must be number
```

## Pipe Operations

### Custom Validation with Check

```typescript
const emailSchema = v.pipe(v.string())
  .check(value => value.includes('@'), 'Must contain @ symbol')
  .check(value => value.includes('.'), 'Must contain dot')
  .check(value => value.length >= 6, 'Must be at least 6 characters')

const result1 = v.execute(emailSchema, 'user@example.com')  // true
const result2 = v.execute(emailSchema, 'userexample.com')   // false - no @
const result3 = v.execute(emailSchema, 'user@example')     // false - no dot
const result4 = v.execute(emailSchema, 'a@b.c')            // false - too short
```

### Type Narrowing

```typescript
const startsWithPrefixSchema = v.pipe(v.string())
  .check(
    (value, { narrow }) => value.startsWith('prefix_') ? narrow<`prefix_${string}`>() : false,
    'Must start with "prefix_"'
  )

const result = v.execute(startsWithPrefixSchema, 'prefix_value')
if (v.isSuccess(result)) {
  // TypeScript knows result.value is `prefix_${string}`
  console.log(result.value.toUpperCase())
}
```

### Data Transformation

```typescript
const ageSchema = v.pipe(v.number())
  .check(value => value >= 0, 'Age must be non-negative')
  .check(value => value <= 150, 'Age must be realistic')
  .transform(value => ({ age: value, isAdult: value >= 18 }))

const result = v.execute(ageSchema, 25)
if (v.isSuccess(result)) {
  console.log(result.value) // { age: 25, isAdult: true }
}
```

### String Processing Pipeline

```typescript
const usernameSchema = v.pipe(v.string())
  .transform(value => value.trim())
  .check(value => value.length >= 3, 'Username must be at least 3 characters')
  .check(value => value.length <= 20, 'Username must be at most 20 characters')
  .check(value => /^\w+$/.test(value), 'Username can only contain letters, numbers, and underscores')
  .transform(value => value.toLowerCase())

const result = v.execute(usernameSchema, '  John_Doe123  ')
if (v.isSuccess(result)) {
  console.log(result.value) // 'john_doe123'
}
```

### Error Recovery with Fallback

```typescript
const robustNumberSchema = v.pipe(v.number())
  .check(value => value >= 0, 'Must be non-negative')
  .fallback(() => 0) // Default to 0 on validation failure

const result1 = v.execute(robustNumberSchema, 42)  // { value: 42 }
const result2 = v.execute(robustNumberSchema, -5)  // { value: 0 } (fallback)
```

## Real-World Examples

### User Registration

```typescript
const registrationSchema = v.object({
  username: v.string(),
  email: v.string(), // In production, add email validation
  password: v.string(),
  age: v.optional(v.number()),
  newsletter: v.boolean(),
})

const validRegistration = {
  username: 'johndoe',
  email: 'john@example.com',
  password: 'secret123',
  age: 25,
  newsletter: true,
}

const result = v.execute(registrationSchema, validRegistration)
if (v.isSuccess(result)) {
  // Save to database
  console.log('Registration successful:', result.value)
}
```

### API Request Validation

```typescript
const apiRequestSchema = v.object({
  method: v.union(v.literal('GET'), v.literal('POST'), v.literal('PUT'), v.literal('DELETE')),
  path: v.pipe(v.string()).check(value => value.startsWith('/'), 'Path must start with /'),
  headers: v.optional(v.object({
    'content-type': v.optional(v.string()),
    'authorization': v.optional(v.string()),
  })),
  body: v.optional(v.unknown()), // Validate based on content-type
})

const request = {
  method: 'POST',
  path: '/api/users',
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer token123',
  },
  body: { name: 'John', age: 30 },
}

const result = v.execute(apiRequestSchema, request)
// Use validated request for processing
```

### Complex Data Processing

```typescript
const userProfileSchema = v.pipe(v.object({
  name: v.string(),
  email: v.string(),
  age: v.number(),
  score: v.optional(v.number()),
}))
  .check(user => user.age >= 13, 'Must be at least 13 years old')
  .transform(user => ({
    ...user,
    email: user.email.toLowerCase().trim(),
    score: user.score ?? 0,
    level: user.age >= 18 ? 'adult' : 'teen',
  }))
  .check(user => user.score >= 0 && user.score <= 100, 'Score must be between 0 and 100')
  .transform((user) => {
    let rank: string
    if (user.score >= 90) rank = 'expert'
    else if (user.score >= 70) rank = 'advanced'
    else if (user.score >= 50) rank = 'intermediate'
    else rank = 'beginner'
    return { ...user, rank }
  })

const input = {
  name: 'Alice Johnson',
  email: 'ALICE@EXAMPLE.COM',
  age: 25,
  score: 85,
}

const result = v.execute(userProfileSchema, input)
if (v.isSuccess(result)) {
  console.log(result.value)
  // {
  //   name: 'Alice Johnson',
  //   email: 'alice@example.com',
  //   age: 25,
  //   score: 85,
  //   level: 'adult',
  //   rank: 'advanced'
  // }
}
```

## Async Validation

### Async Custom Checks

```typescript
const asyncEmailSchema = v.pipe(v.string())
  .check(async (value) => {
    // Simulate API call to check if email exists
    await new Promise(resolve => setTimeout(resolve, 100))
    return !value.includes('spam')
  }, 'Invalid email')

const result = await v.execute(asyncEmailSchema, 'user@example.com')
```

### Async Transformation

```typescript
const asyncUserSchema = v.pipe(v.object({
  name: v.string(),
  email: v.string(),
}))
  .transform(async (user) => {
    // Simulate fetching user ID from database
    await new Promise(resolve => setTimeout(resolve, 10))
    return {
      ...user,
      id: `user_${Date.now()}`,
      email: user.email.toLowerCase(),
    }
  })

const result = await v.execute(asyncUserSchema, {
  name: 'John Doe',
  email: 'JOHN@EXAMPLE.COM',
})
```

## Error Handling

### Detailed Error Information

```typescript
const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.pipe(v.string()).check(email => email.includes('@'), 'Invalid email'),
})

const invalidUser = {
  name: 'John',
  age: 'thirty', // should be number
  email: 'invalid-email', // missing @
}

const result = v.execute(userSchema, invalidUser)
if (!v.isSuccess(result)) {
  result.issues.forEach(issue => {
    console.log(`${issue.code}: ${issue.message}`)
    if (issue.path) {
      console.log(`  Path: ${issue.path.join('.')}`)
    }
  })
  // Output:
  // EXPECTED_NUMBER: Expected number, received "thirty"
  //   Path: age
  // Custom check failed: Invalid email
  //   Path: email
}
```

### Custom Error Messages

```typescript
const customMessageSchema = v.object({
  name: v.string(),
  age: v.number(),
}, {
  message: {
    EXPECTED_OBJECT: 'User data must be an object',
    MISSING_PROPERTY: (code, { path }) => `Required field "${path}" is missing`,
  }
})
```

## TypeScript Integration

### Type Inference

```typescript
const apiResponseSchema = v.object({
  users: v.array(v.object({
    id: v.number(),
    name: v.string(),
    email: v.string(),
  })),
  total: v.number(),
})

// TypeScript automatically infers the correct types
type ApiResponse = v.InferOutput<typeof apiResponseSchema>
// {
//   users: Array<{ id: number; name: string; email: string }>;
//   total: number;
// }

function handleApiResponse(data: unknown): ApiResponse {
  const result = v.execute(apiResponseSchema, data)
  if (v.isSuccess(result)) {
    return result.value // TypeScript knows this is ApiResponse
  }
  throw new Error('Invalid API response')
}
```

### Utility Types

```typescript
// Extract input type
type UserInput = v.InferInput<typeof userSchema>

// Check if schema is async
type IsAsync = v.InferAsync<typeof userSchema> // true or false

// Get execution return type
type ExecuteResult = v.InferExecuteReturn<typeof userSchema>
// Promise<ExecutionResult<UserOutput>> (if async) or ExecutionResult<UserOutput> (if sync)
```

These examples demonstrate the versatility and power of valchecker for handling various validation scenarios in TypeScript applications.