# Setup and Installation

Getting started with Valchecker in your project.

## Installation

### Using pnpm (Recommended)
```bash
pnpm add valchecker
```

### Using npm
```bash
npm install valchecker
```

### Using yarn
```bash
yarn add valchecker
```

## Initial Setup

### For Development (All Steps)

Use this when you're developing and want convenience:

```typescript
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })

const schema = v.string()
const result = schema.run('hello')
```

### For Production (Selective Imports)

Use this to reduce bundle size by only importing what you need:

```typescript
import { createValchecker, string, number, object, array, min, max } from 'valchecker'

const v = createValchecker({ steps: [string, number, object, array, min, max] })

const schema = v.object({
  name: v.string().min(1),
  age: v.number().min(0).max(150),
})
```

## Available Imports

### Core Functions
```typescript
import { createValchecker, Infer, InferInput } from 'valchecker'
```

### All Steps (Convenience)
```typescript
import { allSteps } from 'valchecker'
```

### Individual Steps (Production)
```typescript
// Primitives
import { string, number, boolean, bigint, symbol, literal, unknown, any, never, null_, undefined_ } from 'valchecker'

// Structures
import { object, strictObject, looseObject, array, union, intersection, instance } from 'valchecker'

// Constraints
import { min, max, empty, integer, startsWith, endsWith } from 'valchecker'

// Transforms
import { transform, toTrimmed, toLowercase, toUppercase, toFiltered, toSorted, toAsync } from 'valchecker'

// Flow Control
import { check, fallback, use, as, generic } from 'valchecker'

// Other
import { json, looseNumber, parseJSON, stringifyJSON } from 'valchecker'
```

## First Schema

Here's your first schema:

```typescript
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })

// Define a schema
const userSchema = v.object({
  name: v.string()
    .toTrimmed()
    .min(1),
  email: v.string(),
  age: v.number()
    .integer()
    .min(0),
})

// Validate data
const result = userSchema.run({
  name: '  Alice  ',
  email: 'alice@example.com',
  age: 30,
})

if (result.isOk) {
  console.log('Valid:', result.value)
  // { name: 'Alice', email: 'alice@example.com', age: 30 }
} else {
  console.log('Invalid:', result.issues)
  // Array of validation errors
}
```

## TypeScript Setup

Valchecker works great with TypeScript:

```typescript
const userSchema = v.object({
  name: v.string(),
  age: v.number(),
})

// Automatically inferred type
type User = v.Infer<typeof userSchema>
// { name: string; age: number }

const result = userSchema.run(data)

if (result.isOk) {
  // TypeScript knows result.value is User
  const user: User = result.value
}
```

## TypeScript Configuration

Enable strict mode for better type safety:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

## Next Steps

- Learn [core concepts](./core-concepts.md)
- See [common patterns](./patterns.md)
- Explore [error handling](./error-handling.md)
- Understand [type inference](./type-inference.md)
