# API Overview

This reference documents the complete public API of Valchecker. Each validation step is designed to be composable, type-safe, and runtime-focused.

## Import Strategies

Valchecker provides two ways to import validation steps:

### All Steps (Convenience)

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

Bundles every built-in step into your valchecker instance. Best for:
- Rapid prototyping
- CLI tools
- Applications where bundle size isn't critical

### Selective Imports (Tree-Shaking)

```ts
import { createValchecker, number, object, string } from 'valchecker'

const v = createValchecker({ steps: [string, number, object] })
```

Import only what you need for optimal bundle size. Recommended for:
- Production web applications
- Libraries shipped to npm
- Any size-sensitive deployment

## Complete Step Reference

All 47 built-in steps, organized by category:

### Primitive Type Validators
- `string()` - Validates string type
- `number()` - Validates finite number type
- `boolean()` - Validates boolean type
- `bigint()` - Validates bigint type
- `symbol()` - Validates symbol type
- `literal(value)` - Validates exact value match
- `unknown()` - Passthrough validator (accepts any)
- `any()` - Passthrough with `any` type
- `never()` - Always fails validation

### Nullish Type Validators
- `null_()` - Validates null
- `undefined_()` - Validates undefined

### Structure Validators
- `object(shape)` - Validates object with specific properties (unknown keys allowed)
- `strictObject(shape)` - Validates object and rejects unknown keys
- `looseObject(shape)` - Alias for `object()` (explicitly allows unknown keys)
- `array(elementSchema)` - Validates each array element
- `union(schemas)` - Tries each schema, returns first success
- `intersection(schemas)` - Merges multiple object schemas
- `instance(constructor)` - Validates class instance

### Constraint Validators
- `min(value)` - Validates minimum (for number, bigint, or length)
- `max(value)` - Validates maximum (for number, bigint, or length)
- `integer()` - Validates integer (no decimals)
- `empty()` - Validates empty (length === 0)
- `startsWith(prefix)` - Validates string prefix
- `endsWith(suffix)` - Validates string suffix

### Data Transformation Steps
- `transform(fn)` - Custom transformation function
- `toTrimmed()` - Trim whitespace from both ends
- `toTrimmedStart()` - Trim whitespace from start
- `toTrimmedEnd()` - Trim whitespace from end
- `toUppercase()` - Convert to uppercase
- `toLowercase()` - Convert to lowercase
- `toString()` - Convert to string
- `toSorted(fn?)` - Sort array
- `toFiltered(predicate)` - Filter array elements
- `toSliced(start, end?)` - Slice array
- `toSplitted(separator)` - Split string into array
- `toLength()` - Replace array with its length
- `toAsync()` - Force async operation mode
- `parseJSON()` - Parse JSON string to value
- `stringifyJSON()` - Stringify value to JSON
- `json()` - Validate JSON string (no parse)

### Flow Control Steps
- `check(predicate)` - Custom validation check
- `fallback(getValue)` - Provide default on failure
- `use(schema)` - Delegate to another schema
- `as<T>()` - Type cast (runtime no-op)
- `generic<T>(factory)` - Recursive schema support

### Loose Variants
- `looseNumber()` - Coerce strings to numbers
- `looseObject(shape)` - Object with unknown keys allowed

## Execution API

### Result Type

Every schema returns results of this shape:

```ts
type ExecutionResult<T> =
  | { isOk: true; value: T }
  | { isOk: false; issues: ExecutionIssue[] }

interface ExecutionIssue {
  code: string           // e.g., 'string:expected_string'
  message: string        // Human-readable error
  path: PropertyKey[]    // Location in data: ['user', 'email']
  payload: unknown       // Issue-specific data
}
```

### Execution Methods

```ts
// Sync when possible, async if needed
const result = schema.run(input)
// Returns: ExecutionResult<T> | Promise<ExecutionResult<T>>

// Always async
const result = await schema.execute(input)
// Returns: Promise<ExecutionResult<T>>
```

## API Categories

Navigate to specific category pages for detailed documentation:

- **[Primitives](/api/primitives)** - Base type validators
- **[Structures](/api/structures)** - Compound type validators
- **[Transforms](/api/transforms)** - Data reshaping steps
- **[Helpers](/api/helpers)** - Flow control and utilities

## Method Chaining

All steps support method chaining to build complex pipelines:

```ts
const schema = v.string()
  .toTrimmed()           // Transform
  .check(s => s.length > 0, 'Required')  // Validate
  .toLowercase()         // Transform
  .check(s => /^[a-z]+$/.test(s))  // Validate
```

## Standard Schema Compliance

Valchecker implements [Standard Schema V1](https://github.com/standard-schema/standard-schema), enabling interoperability with compatible libraries and tools.
