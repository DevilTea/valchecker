# Setup and Installation

## Requirements

- Node.js 22 or newer
- ESM

CommonJS applications may load Valchecker through dynamic `import('valchecker')`; synchronous `require()` is unsupported.

## Installation

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

The default `v` instance contains every built-in step.

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
	steps: [
		string,
		number,
		object,
		isFinite,
		isInteger,
		isAtLeast,
		toTrimmed,
	],
})
```

Use selective registration for bundle-sensitive applications. `allSteps` remains available when a custom instance needs every built-in plugin.

## Import groups

```ts
// Initial primitive schemas
import {
	any,
	bigint,
	boolean,
	literal,
	never,
	null_,
	number,
	string,
	symbol,
	undefined_,
	unknown,
} from 'valchecker'

// Loose primitive schemas
import { looseBigint, looseBoolean, looseNumber } from 'valchecker'

// Structural schemas
import {
	array,
	instance,
	intersection,
	looseObject,
	object,
	strictObject,
	union,
} from 'valchecker'

// Built-in validations
import {
	isAtLeast,
	isAtMost,
	isEmpty,
	isEndingWith,
	isFinite,
	isInteger,
	isLengthAtLeast,
	isLengthAtMost,
	isNaN,
	isNotEmpty,
	isStartingWith,
} from 'valchecker'

// Concrete transformations
import {
	toAsync,
	toFiltered,
	toJSONString,
	toJSONValue,
	toLength,
	toLowercase,
	toSliced,
	toSorted,
	toSplit,
	toString,
	toTrimmed,
	toTrimmedEnd,
	toTrimmedStart,
	toUppercase,
} from 'valchecker'

// Generic and flow-control operations
import { as, check, fallback, generic, transform, use } from 'valchecker'
```

## First execution

```ts
const result = schema.execute({
	name: '  Alice  ',
	age: 30,
})

if (v.isSuccess(result)) {
	console.log(result.value)
}
else {
	console.error(result.issues)
}
```

Use `await schema.execute(input)` when either synchronous or asynchronous completion is acceptable. Append `.toAsync()` when every invocation must return a native promise.

## Type inference

Advanced type helpers come from the semver-covered `@valchecker/internal` root:

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

Transforms update output inference, and one-element tuples mark object properties optional.

## TypeScript configuration

Use strict mode and a modern module resolution mode:

```json
{
	"compilerOptions": {
		"strict": true,
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext"
	}
}
```

`Bundler` resolution is also supported for bundler-based applications.