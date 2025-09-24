# Getting Started

## Installation

Install valchecker using your preferred package manager:

```bash
# npm
npm install valchecker

# pnpm
pnpm add valchecker

# yarn
yarn add valchecker

# bun
bun add valchecker
```

## Basic Usage

Valchecker provides a simple, fluent API for data validation. Here's a basic example:

```typescript
import * as v from 'valchecker'

// Create a schema
const stringSchema = v.string()

// Validate data
const result = v.execute(stringSchema, 'hello world')

if (v.isSuccess(result)) {
  console.log('Valid!', result.value) // 'hello world'
} else {
  console.log('Invalid:', result.issues)
}
```

## Import Patterns

Valchecker supports several import patterns depending on your needs:

### Full Import (Recommended)
```typescript
import * as v from 'valchecker'

const schema = v.object({
  name: v.string(),
  age: v.number()
})
```

### Named Imports
```typescript
import { string, number, object, execute, isSuccess } from 'valchecker'

const schema = object({
  name: string(),
  age: number()
})

const result = execute(schema, { name: 'John', age: 30 })
```

### Tree Shaking Friendly
```typescript
import { string } from 'valchecker/schemas/string'
import { number } from 'valchecker/schemas/number'
import { object } from 'valchecker/schemas/object'
import { execute } from 'valchecker/core'

const schema = object({
  name: string(),
  age: number()
})
```

## Your First Schema

Let's create a user registration schema:

```typescript
import * as v from 'valchecker'

const userSchema = v.object({
  username: v.string(),
  email: v.string(),
  age: v.optional(v.number()),
  active: v.boolean()
})

// Valid data
const validUser = {
  username: 'johndoe',
  email: 'john@example.com',
  age: 25,
  active: true
}

const result = v.execute(userSchema, validUser)
console.log(v.isSuccess(result)) // true

// Invalid data
const invalidUser = {
  username: 'johndoe',
  email: 'not-an-email',
  age: 'twenty-five', // should be number
  active: 'yes' // should be boolean
}

const invalidResult = v.execute(userSchema, invalidUser)
console.log(v.isSuccess(invalidResult)) // false
```

## TypeScript Integration

Valchecker works seamlessly with TypeScript:

```typescript
import * as v from 'valchecker'

const userSchema = v.object({
  name: v.string(),
  age: v.number()
})

// TypeScript infers the exact type
type User = v.InferOutput<typeof userSchema>
// Equivalent to: { name: string; age: number }

function createUser(data: unknown): User {
  const result = v.execute(userSchema, data)
  if (v.isSuccess(result)) {
    return result.value // TypeScript knows this is User
  }
  throw new Error('Invalid user data')
}
```

## Next Steps

Now that you have the basics, explore:

- [Core Concepts](./core-concepts.md) - Understanding how valchecker works
- [Examples](./examples.md) - More comprehensive usage patterns
- [API Reference](./api-core.md) - Complete function reference