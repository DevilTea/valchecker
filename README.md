# valchecker

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

> Runtime-first validation with zero guesswork

A modular TypeScript validation library with composable immutable steps, inferred transformed outputs, structured issues, sync/maybe-async execution, and Standard Schema V1 compatibility.

## Requirements

- Node.js 22 or newer
- ESM

CommonJS applications may load Valchecker with dynamic `import('valchecker')`. Synchronous `require('valchecker')` is not supported.

## Installation

```bash
pnpm add valchecker
# or
npm install valchecker
# or
yarn add valchecker
# or
bun add valchecker
```

## Quick start

The main package exports `v`, a ready-to-use instance with every built-in step:

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string().toTrimmed(),
	email: v.string().toLowercase(),
	age: v.number().isInteger().isAtLeast(0),
	nickname: [v.string()],
})

const result = await userSchema.execute({
	name: '  Alice  ',
	email: 'ALICE@EXAMPLE.COM',
	age: 25,
})

if (v.isSuccess(result)) {
	console.log(result.value)
	// {
	//   name: 'Alice',
	//   email: 'alice@example.com',
	//   age: 25,
	//   nickname: undefined,
	// }
}
else {
	console.error(result.issues)
}
```

## Selective imports

Build an instance from only the steps used by an application:

```ts
import {
	createValchecker,
	isAtLeast,
	isInteger,
	number,
	object,
	string,
	toTrimmed,
} from 'valchecker'

const v = createValchecker({
	steps: [string, number, object, isInteger, isAtLeast, toTrimmed],
})
```

`allSteps` is also exported for custom instances that need every built-in plugin.

## Naming and type semantics

Built-in steps follow a predictable fluent API:

- initial steps use nouns, such as `string()`, `number()`, and `looseBoolean()`,
- validation steps use `isXxx()`, such as `isFinite()` and `isLengthAtLeast()`,
- concrete transformations use `toXxx()`, such as `toTrimmed()`, `toNumber()`, and `toJSONValue()`,
- generic escape hatches retain the direct names `check()` and `transform()`.

Primitive initial steps align with TypeScript primitive types. In particular, `number()` accepts every JavaScript number, including `NaN`, `Infinity`, and `-Infinity`. Add `.isFinite()` when finite values are required.

Loose primitive steps accept the primitive itself or its corresponding TypeScript template-literal representation, then normalize the output:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('0x10') // { value: 16n }
```

They do not perform general JavaScript truthiness or unrestricted coercion.

### Primitive conversions

Native coercion transformations delegate directly to JavaScript:

```ts
v.string().toNumber() // Number(value)
v.string().toBoolean() // Boolean(value)
v.string().toBigint() // BigInt(value)
```

They intentionally do not hide extra policy:

```ts
v.string().toNumber().execute('invalid')
// { value: NaN }

v.string().toBoolean().execute('false')
// { value: true }

v.bigint().toNumber().execute(9007199254740993n)
// { value: 9007199254740992 }
```

`toBigint()` converts native `BigInt()` exceptions into structured validation issues. Explicit policy conversions remain separate:

```ts
v.bigint().toSafeNumber()

v.string().toMappedBoolean({
	trueValues: ['Y', 'yes'],
	falseValues: ['N', 'no'],
})

v.number().toMappedBoolean({
	trueValues: [1],
	falseValues: [0],
})
```

Identity conversions such as `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware fluent API.

## Execution semantics

`execute()` preserves the pipeline's execution mode:

- fully synchronous pipelines return a result directly,
- reached asynchronous or thenable work returns a native `Promise`,
- callback-driven pipelines can be maybe-async because an earlier synchronous failure may bypass later async work.

```ts
const synchronous = v.string().toTrimmed()
const direct = synchronous.execute(' value ')
// { value: 'value' }

const maybeAsync = v.string().check(async value => value.length > 0)
const promise = maybeAsync.execute('value')
// Promise<ExecutionResult<string>>

const earlyFailure = maybeAsync.execute(42)
// Synchronous failure; the async callback is not reached.
```

Use `await` when either completion mode is acceptable. Append `.toAsync()` when an API boundary must always return a native promise.

Valchecker assimilates `PromiseLike` values, including custom thenables and cross-realm promises.

## Results and issues

Success returns the final transformed output:

```ts
type Success<T> = { value: T }
```

Failure returns structured issues:

```ts
type Failure<Issue> = { issues: Issue[] }

interface Issue {
	code: string
	path: PropertyKey[]
	message: string
	payload: unknown
}
```

Validation failures are values rather than thrown validation exceptions. Nested validators prepend issue paths without mutating issue objects returned by child schemas.

## Objects

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.number()],
})
```

Declared fields are read from own properties only.

- `object(shape)` validates declared fields and omits unknown properties from output.
- `strictObject(shape)` rejects unknown enumerable own string and symbol keys.
- `looseObject(shape)` validates declared fields and preserves unknown own properties.

Declared `__proto__` fields are materialized as safe own data properties and do not mutate the output prototype.

## Map and Set collections

```ts
const tags = v.set(v.string().toTrimmed().toLowercase())

const scores = v.map({
	key: v.string().toTrimmed(),
	value: v.number().isFinite(),
})
```

Collection child schemas run in insertion order and return new transformed collections. Map key/value failures use `[index, 'key']` and `[index, 'value']`; Set item failures use `[index]`. Transformed Map keys and Set items must remain unique under SameValueZero, so validation fails rather than silently losing data.

```ts
const requiredTags = tags
	.isNotEmpty()
	.isSizeAtMost(5)
	.isIncluding('required')

const scoreCount = scores
	.isIncludingKey('primary')
	.isIncludingValue(1)
	.toSize()
```

Size validations preserve the collection and snapshot the observed `size` in failure payloads. `toSize()` replaces the collection with its numeric size. Set and Map membership follow SameValueZero equality.

Collection representations remain explicit and preserve insertion order:

```ts
tags.toArray() // string[]
scores.toKeys() // string[]
scores.toValues() // number[]
scores.toEntries() // Array<[string, number]>
```

These transformations return new arrays and do not mutate the source collection. Map-to-object conversion is intentionally not implied because it requires separate key, prototype, and collision policies.

Callback transforms preserve the same state-aware collection APIs:

```ts
const mappedTags = tags
	.toMapped((item, index) => `${index}:${item}`)
	.toFiltered(item => item.length > 2)

const normalizedScores = scores
	.toMappedKeys(key => key.toLowerCase())
	.toMappedValues(value => value * 2)
```

Collection callbacks are synchronous and receive the current transformed collection. Traversal uses a step-start snapshot. Set item and Map key mapping reject SameValueZero collisions rather than silently losing data.

## Composition

### Union

`union()` evaluates branches in order and returns the first successful branch's transformed output.

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])

await schema.execute('abc')
// { value: 3 }
```

### Variant

`variant()` performs direct discriminated-union dispatch and executes only the selected branch:

```ts
const event = v.variant({
	discriminator: 'type',
	variants: {
		click: v.object({ type: v.literal('click'), x: v.number(), y: v.number() }),
		keypress: v.object({ type: v.literal('keypress'), key: v.string() }),
	},
})
```

The discriminator must be an own property. Child issue paths are preserved, selected-branch provenance is recorded in issue context, and unselected branches are not executed.

### Intersection

`intersection()` recursively composes compatible plain-object outputs, including enumerable symbol keys, cycles, and aliases. Equal primitive values and the same non-plain object reference are preserved. Incompatible outputs fail with `intersection:conflicting_outputs`; distinct class, `Date`, or `Map` instances are not spread into plain objects.

### Delegation

`use(schema)` preserves the delegated schema's transformed output and issues.

## Transformations and recovery

```ts
const configSchema = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.fallback(() => ({ port: 3000 }))
	.use(v.object({
		port: v.number().isInteger().isAtLeast(1).isAtMost(65535),
	}))
```

Transform, check, fallback, and plugin callbacks may return direct or `PromiseLike` values according to their step contract.

## Message priority

Issue messages resolve in this order:

1. custom step message,
2. global `createValchecker` message handler,
3. built-in default message,
4. `"Invalid value."`.

## Type inference

Advanced type helpers are exported from the semver-covered `@valchecker/internal` package:

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed(),
	tags: [v.array(v.string())],
})

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

`@valchecker/internal` is the supported root API for plugin authors and advanced types. Package-private source paths are not public API.

## Standard Schema V1

Every schema exposes `~standard` for integrations accepting Standard Schema V1 implementations:

```ts
const result = schema['~standard'].validate(input)
```

The Standard Schema interface preserves sync/maybe-async behavior and returns transformed output on success.

## Packages

| Package | Purpose |
| --- | --- |
| `valchecker` | Normal application API, default `v`, all built-in steps and public helpers |
| `@valchecker/all-steps` | `allSteps` collection for custom instances |
| `@valchecker/internal` | Semver-covered advanced types and step-plugin author API |

Runtime and declaration exports are recorded in `api-surface.json`; CI rejects unreviewed public API drift.

## Documentation

- [Quick Start](https://deviltea.github.io/valchecker/guide/quick-start)
- [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract)
- [Migrating to 1.0](https://deviltea.github.io/valchecker/guide/migration-to-1)
- [Custom Steps](https://deviltea.github.io/valchecker/guide/custom-steps)
- [API Reference](https://deviltea.github.io/valchecker/api/overview)
- [Examples](https://deviltea.github.io/valchecker/examples/basic-validation)
- [Complete migration guide](./MIGRATION.md)
- [Changelog](./CHANGELOG.md)
- [Support policy](./SUPPORT.md)
- [Release process](./RELEASING.md)

## Development

```bash
git clone https://github.com/DevilTea/valchecker.git
cd valchecker
pnpm install
pnpm build
pnpm test
pnpm docs:dev
```

Before opening a pull request, run the repository checks documented in `AGENTS.md`.

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
