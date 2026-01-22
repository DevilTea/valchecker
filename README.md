# valchecker

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

> Runtime-first validation with zero guesswork

A modular TypeScript validation library with composable steps, full type inference, and deterministic issue reporting. Compliant with [Standard Schema V1](https://github.com/standard-schema/standard-schema).

## Features

- **Composable Step Pipeline** - Chain validation, transformation, and error handling steps with a fluent API
- **Full Type Inference** - TypeScript types flow through transforms, narrowing checks, and fallback chains automatically
- **Deterministic Issue Reporting** - Structured errors with codes, payloads, and deep paths for precise debugging
- **Tree-Shakable by Design** - Import all steps for prototyping or cherry-pick for minimal production bundles
- **Async-Safe Pipelines** - Mix synchronous and asynchronous validation seamlessly in the same pipeline
- **Batteries-Included Transforms** - Trim strings, parse JSON, filter arrays, and normalize data inline

## Installation

```bash
# pnpm
pnpm add valchecker

# npm
npm install valchecker

# yarn
yarn add valchecker

# bun
bun add valchecker
```

**Requirements:** Node.js 18+ (ESM and CommonJS supported)

## Quick Start

### Basic Usage

```typescript
import { allSteps, createValchecker } from 'valchecker'

// Create a valchecker instance with all available steps
const v = createValchecker({ steps: allSteps })

// Define a schema
const userSchema = v.object({
  name: v.string().toTrimmed(),
  email: v.string().toLowercase(),
  age: v.number().min(0),
})

// Validate data
const result = await userSchema.execute({
  name: '  Alice  ',
  email: 'ALICE@EXAMPLE.COM',
  age: 25,
})

if (v.isSuccess(result)) {
  console.log(result.value)
  // { name: 'Alice', email: 'alice@example.com', age: 25 }
} else {
  console.error(result.issues)
  // Array of structured validation issues
}
```

### Tree-Shakable Imports (Production)

```typescript
import { createValchecker, number, object, string, min, toTrimmed, toLowercase } from 'valchecker'

// Import only the steps you need
const v = createValchecker({
  steps: [string, number, object, min, toTrimmed, toLowercase]
})
```

### Optional Properties

```typescript
const schema = v.object({
  name: v.string(),
  nickname: [v.string()], // Wrap in [] for optional
})

schema.execute({ name: 'Alice' })
// { value: { name: 'Alice', nickname: undefined } }
```

### Async Validation

```typescript
const usernameSchema = v.string()
  .toTrimmed()
  .toLowercase()
  .min(3, 'Username must be at least 3 characters')
  .check(async (value) => {
    const exists = await db.users.exists({ username: value })
    return exists ? 'Username already taken' : true
  })

const result = await usernameSchema.execute('Alice')
```

### Transforms and Fallbacks

```typescript
const configSchema = v.unknown()
  .parseJSON('Invalid JSON')
  .fallback(() => ({ port: 3000 }))
  .use(
    v.object({
      port: v.number().integer().min(1).max(65535),
    })
  )

const result = await configSchema.execute('{"port": 8080}')
// { value: { port: 8080 } }

const fallbackResult = await configSchema.execute('invalid json')
// { value: { port: 3000 } }
```

### Custom Error Messages

```typescript
// Per-step messages
const schema = v.number()
  .min(1, 'Quantity must be at least 1')
  .max(100, ({ payload }) => `Maximum is 100, got ${payload.value}`)

// Global message handler
const v = createValchecker({
  steps: allSteps,
  message: ({ code, payload }) => {
    const messages = {
      'string:expected_string': 'Please enter text',
      'number:expected_number': 'Please enter a number',
      'min:expected_min': `Minimum value is ${payload.expected}`,
    }
    return messages[code] ?? 'Validation failed'
  },
})
```

## API Reference

### Primitives

| Step | Description | Issue Code |
|------|-------------|------------|
| `string(message?)` | Validates string values | `string:expected_string` |
| `number(message?)` | Validates finite numbers | `number:expected_number` |
| `boolean(message?)` | Validates boolean values | `boolean:expected_boolean` |
| `bigint(message?)` | Validates bigint values | `bigint:expected_bigint` |
| `symbol(message?)` | Validates symbol values | `symbol:expected_symbol` |
| `literal(value, message?)` | Matches exact literal value | `literal:expected_literal` |
| `null_(message?)` | Accepts only null | `null:expected_null` |
| `undefined_(message?)` | Accepts only undefined | `undefined:expected_undefined` |
| `unknown()` | Accepts any value | - |
| `never(message?)` | Always fails | `never:unexpected_value` |
| `any()` | Accepts any value (typed as any) | - |

### Structures

| Step | Description | Issue Code |
|------|-------------|------------|
| `object(shape, message?)` | Validates object with schema | `object:expected_object` |
| `strictObject(shape, message?)` | Rejects unknown keys | `object:unknown_key` |
| `looseObject(shape, message?)` | Allows unknown keys (alias for object) | `object:expected_object` |
| `array(schema, message?)` | Validates array elements | `array:expected_array` |
| `union(schemas)` | First matching schema wins | (from branches) |
| `intersection(schemas)` | Merges all schema results | (from schemas) |
| `instance(constructor, message?)` | Validates class instances | `instance:expected_instance` |

### Constraints

| Step | Description | Issue Code |
|------|-------------|------------|
| `min(value, message?)` | Minimum value/length | `min:expected_min` |
| `max(value, message?)` | Maximum value/length | `max:expected_max` |
| `integer(message?)` | Validates integer numbers | `integer:expected_integer` |
| `empty(message?)` | Validates empty string/array | `empty:expected_empty` |
| `startsWith(prefix, message?)` | String starts with prefix | `startsWith:expected_starts_with` |
| `endsWith(suffix, message?)` | String ends with suffix | `endsWith:expected_ends_with` |

### Transforms

| Step | Description |
|------|-------------|
| `toTrimmed()` | Trim whitespace from both ends |
| `toTrimmedStart()` | Trim whitespace from start |
| `toTrimmedEnd()` | Trim whitespace from end |
| `toUppercase()` | Convert to uppercase |
| `toLowercase()` | Convert to lowercase |
| `toFiltered(predicate)` | Filter array elements |
| `toSorted(compareFn?)` | Sort array |
| `toSliced(start, end?)` | Slice array |
| `toSplitted(separator)` | Split string into array |
| `toLength()` | Get string/array length |
| `toString()` | Convert number to string |
| `parseJSON(message?)` | Parse JSON string |
| `stringifyJSON(message?)` | Stringify to JSON |

### Flow Control

| Step | Description | Issue Code |
|------|-------------|------------|
| `check(predicate, message?)` | Custom validation logic | `check:failed` |
| `transform(fn, message?)` | Transform value | `transform:failed` |
| `fallback(getValue)` | Provide fallback on failure | `fallback:failed` |
| `use(schema)` | Delegate to another schema | (from target) |
| `as<T>()` | Type assertion (no runtime check) | - |
| `generic<T>(factory)` | Recursive schema support | - |
| `toAsync()` | Force async execution | - |

## Comparison with Other Libraries

| Feature | valchecker | Zod | Yup | Valibot |
|---------|------------|-----|-----|---------|
| Bundle Size (min+gzip) | ~3KB* | ~14KB | ~15KB | ~1KB |
| Tree-Shakable | Yes | Partial | No | Yes |
| Full Type Inference | Yes | Yes | Partial | Yes |
| Async Validation | Yes | Yes | Yes | Yes |
| Standard Schema V1 | Yes | Yes | No | Yes |
| Transform Pipeline | Yes | Yes | Yes | Yes |
| Custom Plugins | Yes | No | No | No |
| Deterministic Errors | Yes | Partial | Partial | Yes |

*With selective imports; ~8KB with allSteps

## FAQ

### How do I handle optional fields?

Wrap the schema in an array `[]`:

```typescript
const schema = v.object({
  required: v.string(),
  optional: [v.string()], // undefined is allowed
})
```

### How do I validate discriminated unions?

Use `union` with `literal` for the discriminant:

```typescript
const eventSchema = v.union([
  v.object({
    type: v.literal('click'),
    x: v.number(),
    y: v.number(),
  }),
  v.object({
    type: v.literal('keypress'),
    key: v.string(),
  }),
])
```

### How do I create recursive schemas?

Use `generic` for self-referential types:

```typescript
interface TreeNode {
  value: number
  children?: TreeNode[]
}

const nodeSchema = v.object({
  value: v.number(),
  children: [v.array(
    v.generic<{ output: TreeNode }>(() => nodeSchema as any)
  )],
})
```

### How do I get the inferred type from a schema?

Use TypeScript's `Awaited` and `ReturnType`:

```typescript
const schema = v.object({ name: v.string() })

type SchemaOutput = Awaited<ReturnType<typeof schema.execute>> extends { value: infer T } ? T : never
// { name: string }
```

### Why use `execute()` instead of `parse()`?

Valchecker returns a discriminated union result instead of throwing errors:

```typescript
const result = await schema.execute(input)

if (v.isSuccess(result)) {
  // result.value is typed
} else {
  // result.issues contains structured errors
}
```

This pattern enables:
- Type-safe error handling without try/catch
- Collecting multiple validation errors
- Deterministic behavior without exceptions

### How do I integrate with form libraries?

Map the issues array to your form's error format:

```typescript
const result = await schema.execute(formData)

if (v.isFailure(result)) {
  const errors = Object.fromEntries(
    result.issues.map(issue => [
      issue.path.join('.'),
      issue.message
    ])
  )
  // { 'user.email': 'Invalid email format' }
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes following the code style in `AGENTS.md`
4. Run verification: `pnpm lint && pnpm typecheck && pnpm test`
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push and create a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/DevilTea/valchecker.git
cd valchecker

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start docs dev server
pnpm docs:dev
```

## Documentation

Full documentation is available at [https://deviltea.github.io/valchecker/](https://deviltea.github.io/valchecker/)

- [Quick Start Guide](https://deviltea.github.io/valchecker/guide/quick-start)
- [Core Philosophy](https://deviltea.github.io/valchecker/guide/core-philosophy)
- [API Reference](https://deviltea.github.io/valchecker/api/overview)
- [Examples](https://deviltea.github.io/valchecker/examples/async-validation)

## License

[MIT](./LICENSE) License © 2025-PRESENT [DevilTea](https://github.com/DevilTea)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/valchecker?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/valchecker
[npm-downloads-src]: https://img.shields.io/npm/dm/valchecker?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/valchecker
[bundle-src]: https://img.shields.io/bundlephobia/minzip/valchecker?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=valchecker
[license-src]: https://img.shields.io/github/license/DevilTea/valchecker.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/DevilTea/valchecker/blob/main/LICENSE
