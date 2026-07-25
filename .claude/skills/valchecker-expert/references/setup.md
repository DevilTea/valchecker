# Setup and Installation

## Runtime requirements

The published packages are ESM-only and declare Node.js 22 or newer. Synchronous CommonJS `require()` is unsupported; a CommonJS application can use dynamic `import('valchecker')`.

```bash
pnpm add valchecker
# or
npm install valchecker
```

## Default instance

```ts
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	age: v.number().isFinite().isInteger().isAtLeast(0),
})
```

The default `v` is created with `allSteps` and therefore registers every built-in plugin.

## Selective instance

```ts
import {
	createValchecker,
	isAtLeast,
	isFinite,
	isInteger,
	number,
	object,
	string,
	toTrimmed,
} from 'valchecker'

const v = createValchecker({
	steps: [string, number, object, isFinite, isInteger, isAtLeast, toTrimmed],
})
```

Selective registration retains the fluent API while allowing unregistered plugins to be eliminated from bundle-sensitive builds. A custom instance that intentionally needs every built-in can use `allSteps` from `valchecker` or `@valchecker/all-steps`.

## Execution

```ts
const result = schema.execute({ name: '  Alice  ', age: 30 })

if (v.isSuccess(result))
	console.log(result.value)
else
	console.error(result.issues)
```

Use `await schema.execute(input)` when either direct or promise completion is acceptable. Append `.toAsync()` when every call must return a native promise.

## Type helpers

Application-facing type helpers are re-exported by `valchecker`:

```ts
import type { InferInput, InferOutput } from 'valchecker'

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

Plugin authors can install and import the semver-covered `@valchecker/internal` root for advanced plugin APIs. Do not import package-private source paths.

## TypeScript

Use strict mode and a modern ESM-compatible resolver. `NodeNext` and bundler-based module resolution are supported by the published ESM exports.
