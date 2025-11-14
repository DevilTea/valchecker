# API Overview

This reference documents the complete public API of valchecker. Each validation step is designed to be composable, type-safe, and runtime-focused.

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

## API Categories

| Category | Description |
| --- | --- |
| **[Primitives](/api/primitives)** | Base validators for strings, numbers, booleans, literals, and nullish types |
| **[Structures](/api/structures)** | Higher-level builders for objects, arrays, unions, intersections, and records |
| **[Transforms](/api/transforms)** | Steps that reshape data (trim, parse JSON, filter arrays, etc.) |
| **[Helpers & Utilities](/api/helpers)** | Flow control operations like `check`, `transform`, `fallback`, and `use` |

## Execution Model

Every schema exposes an `execute()` method that validates input and returns a result:

```ts
const schema = v.object({
	title: v.string(),
	count: v.number(),
})

const result = await schema.execute({ title: 'Hello', count: 42 })

if (v.isSuccess(result)) {
	console.log(result.value) // { title: 'Hello', count: 42 }
}
else {
	console.error(result.issues) // Structured array of validation errors
}
```

### Type Guards

- `v.isSuccess(result)` - Narrows to `{ value: T }`
- `v.isFailure(result)` - Narrows to `{ issues: ExecutionIssue[] }`

## Reading the Docs

Each API page includes:

1. **Method signature** - TypeScript interface
2. **Parameters** - Required and optional configuration
3. **Return type** - Inferred output type
4. **Issue codes** - Possible validation failure codes
5. **Examples** - Common usage patterns

Navigate to a specific category to explore all available steps:

- [Primitives](/api/primitives)
- [Structures](/api/structures)
- [Transforms](/api/transforms)
- [Helpers & Utilities](/api/helpers)
