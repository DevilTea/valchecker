---
name: valchecker-expert
description: Comprehensive guide for using Valchecker in your projects. Use this skill when implementing validation with valchecker - defining schemas, handling errors, type inference, async validation, and integration patterns.
---

# Valchecker Expert Guide

This skill provides guidance for using Valchecker to add validation to your projects. Use this when defining schemas, handling validation results, working with type inference, or integrating Valchecker with your application.

## Quick Start

### Installation

```bash
pnpm add valchecker
# or: npm install valchecker, yarn add valchecker
```

### First Schema

```typescript
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })

const userSchema = v.object({
  name: v.string().toTrimmed().min(1),
  email: v.string(),
  age: v.number().integer().min(0),
})

const result = userSchema.run({
  name: '  Alice  ',
  email: 'alice@example.com',
  age: 30,
})

if ('value' in result) {
  console.log('Valid:', result.value)
} else {
  console.log('Errors:', result.issues)
}
```

## Documentation

This skill is organized into modular guides:

### Core Learning
- [**Setup & Installation**](./references/setup.md) - Getting started
- [**Core Concepts**](./references/core-concepts.md) - Schemas, pipelines, results
- [**Type Inference**](./references/type-inference.md) - Advanced typing

### Usage Patterns
- [**Common Patterns**](./references/patterns.md) - Forms, APIs, databases
- [**Error Handling**](./references/error-handling.md) - Validation errors, recovery
- [**Performance**](./references/performance.md) - Optimization tips

### Reference
- [**Step Reference**](./references/step-reference.md) - Complete step documentation

## Key Concepts

### Schemas

A schema validates data through a pipeline of steps:

```typescript
const schema = v.string()
  .toTrimmed()
  .toLowercase()
  .min(3)
  .check(v => v !== 'admin')
```

### Results

Validation returns a discriminated union:

```typescript
const result = schema.run(data)

if ('value' in result) {
  // Success: result.value is validated and typed
  const value: string = result.value
} else {
  // Failure: result.issues contains errors
  for (const issue of result.issues) {
    console.log(`${issue.code}: ${issue.message}`)
  }
}
```

### Type Inference

Automatically inferred types:

```typescript
const schema = v.object({
  name: v.string(),
  age: v.number(),
})

type User = v.Infer<typeof schema>
// { name: string; age: number }
```

## Available Steps

### Primitives
`string`, `number`, `boolean`, `bigint`, `symbol`

### Types
`literal`, `unknown`, `any`, `never`, `null_`, `undefined_`

### Structures
`object`, `strictObject`, `looseObject`, `array`, `union`, `intersection`, `instance`

### Constraints
`min`, `max`, `empty`, `integer`, `startsWith`, `endsWith`

### Transforms
`transform`, `toTrimmed`, `toLowercase`, `toUppercase`, `toFiltered`, `toSorted`, `toSliced`, `toSplitted`, `toLength`, `parseJSON`, `stringifyJSON`, `toAsync`, `json`

### Flow Control
`check`, `fallback`, `use`, `as`, `generic`

See [Step Reference](./references/step-reference.md) for complete documentation.

## Common Tasks

### Form Validation

```typescript
const formSchema = v.object({
  email: v.string().toTrimmed().toLowercase(),
  password: v.string().min(8),
})

const result = formSchema.run(formData)
if ('issues' in result) {
  displayErrors(result.issues)
}
```

See [Common Patterns](./references/patterns.md) for more examples.

### API Validation

```typescript
const requestSchema = v.object({
  page: v.number().integer().min(1).fallback(() => 1),
  limit: v.number().integer().min(1).max(100).fallback(() => 20),
})

const validated = requestSchema.run(req.query)
```

### Async Validation

```typescript
const schema = v.string()
  .check(async (email) => {
    const exists = await checkEmailExists(email)
    return !exists  // Return boolean
  })

const result = await schema.run(email)  // Await when async
```

See [Error Handling](./references/error-handling.md) for error management.

## Type Inference

### Basic Types

```typescript
type User = v.Infer<typeof userSchema>
```

### Input Types

```typescript
type UserInput = v.InferInput<typeof userSchema>
```

### Optional Fields

```typescript
const schema = v.object({
  name: v.string(),           // Required
  nickname: [v.string()],     // Optional
})

type T = v.Infer<typeof schema>
// { name: string; nickname?: string }
```

See [Type Inference Guide](./references/type-inference.md) for advanced patterns.

## Best Practices

1. **Start with production imports** - Only import what you need
2. **Compose schemas** - Build reusable schema pieces
3. **Custom messages** - Provide helpful error messages
4. **Test validation** - Validate your validation logic
5. **Handle errors** - Always check for `value` or `issues`

## Production Bundle Size

Use selective imports for smaller bundles:

```typescript
import { createValchecker, string, number, object, min, max } from 'valchecker'

const v = createValchecker({ steps: [string, number, object, min, max] })
```

Compare with development (uses all steps):

```typescript
import { allSteps, createValchecker } from 'valchecker'
const v = createValchecker({ steps: allSteps })
```

## Getting Help

- **Setup issues?** See [Setup Guide](./references/setup.md)
- **How to use a feature?** Check [Core Concepts](./references/core-concepts.md)
- **Need a pattern?** Find it in [Common Patterns](./references/patterns.md)
- **Need all steps?** See [Step Reference](./references/step-reference.md)
- **Error handling?** Check [Error Handling](./references/error-handling.md)

## External Resources

- [Valchecker Docs](https://valchecker.dev) - User documentation
- [GitHub Repository](https://github.com/anomalyco/valchecker) - Source code
- [Issues](https://github.com/anomalyco/valchecker/issues) - Bug reports

## Next Steps

1. Read [Setup & Installation](./references/setup.md) to get started
2. Learn [Core Concepts](./references/core-concepts.md)
3. Explore [Common Patterns](./references/patterns.md) for your use case
4. Reference [Step Reference](./references/step-reference.md) as needed
