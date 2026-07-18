# Core Concepts

## Schemas are immutable pipelines

```ts
const user = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	age: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(0),
})
```

Each fluent method returns a new schema. A reached step may preserve the value, transform it, produce structured issues, recover from a prior failure, or delegate to another schema.

## Method names identify roles

| Role | Convention | Examples |
| --- | --- | --- |
| Initial schema | noun | `string()`, `number()`, `looseBigint()` |
| Built-in validation | `isXxx()` | `isFinite()`, `isNotEmpty()`, `isLengthAtMost()` |
| Concrete transformation | `toXxx()` | `toTrimmed()`, `toSplit()`, `toJSONValue()` |
| Generic operation | direct verb | `check()`, `transform()`, `fallback()`, `use()` |

`check()` and `transform()` remain generic escape hatches because their callbacks define the actual condition or output.

## Primitive identity versus policy

Primitive schemas match TypeScript identities:

```ts
v.number().execute(Number.NaN) // success
v.number().execute(Infinity) // success
```

Add runtime policy explicitly:

```ts
v.number().isFinite()
v.number().isInteger()
v.number().isFinite().isAtLeast(0)
```

A named validation enforces only the condition it states. `isAtLeast(0)` accepts positive infinity.

## Loose primitive normalization

Loose primitives accept a canonical primitive or a TypeScript-compatible string representation, then output the primitive:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

They do not use unrestricted JavaScript coercion.

## Execution mode

`execute()` preserves the completion mode of reached work:

```ts
const synchronous = v.string().toTrimmed()
synchronous.execute(' value ') // direct result

const maybeAsync = v.string().check(async value => value.length > 0)
maybeAsync.execute('value') // Promise<ExecutionResult<string>>
maybeAsync.execute(42) // direct early failure
```

Awaiting either mode is safe. Append `.toAsync()` when every invocation must return a native promise.

## Results

```ts
type ExecutionResult<T, Issue>
	= | { value: T }
		| { issues: Issue[] }
```

Use `v.isSuccess()` and `v.isFailure()` to narrow the result.

Each issue contains:

```ts
interface Issue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

Examples include:

```text
string:expected_string
isFinite:expected_finite
isAtLeast:expected_at_least
isLengthAtMost:expected_length_at_most
toJSONValue:invalid_json
```

Issue paths identify nested object fields and array indices. Parent schemas prepend paths by cloning issues rather than mutating child issue objects.

## Optional object fields

A one-element tuple marks a field optional:

```ts
const user = v.object({
	name: v.string(),
	nickname: [v.string()],
	tags: [v.array(v.string())],
})
```

Declared object fields are read from own properties only.

## Object variants

- `object(shape)` omits unknown output properties.
- `strictObject(shape)` rejects unknown enumerable own string and symbol keys.
- `looseObject(shape)` preserves unknown own properties.

## Transformation and output inference

```ts
const schema = v.string()
	.toSplit(',')
	.toFiltered(value => value.length > 0)
	.toLength()
```

The input is `string`; the output is `number`.

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

## Composition

```ts
const address = v.object({
	street: v.string(),
	city: v.string(),
})

const user = v.object({
	name: v.string(),
	address,
})
```

- `array()` validates and transforms elements.
- `union()` returns the first successful branch's transformed output.
- `intersection()` composes compatible outputs.
- `use()` delegates the current value to another schema.
- `generic()` supports lazy and recursive schemas.

## Messages

```ts
const quantity = v.number().isAtLeast(1, { message: ({ payload }) => `Expected at least ${payload.minimum}, received ${payload.value}` }
)
```

Message priority is per-step, global resolver, built-in default, then `"Invalid value."`.