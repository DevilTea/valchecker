# Valchecker

A modular TypeScript validation library with composable immutable steps, full transformed-output inference, structured issues, and a tree-shakable fluent API.

## Installation

```bash
pnpm add valchecker
# or
npm install valchecker
```

## Quick start

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	age: v.number().isFinite().isInteger().isAtLeast(0),
	tags: v.array(v.string()).isLengthAtMost(10),
})

const result = userSchema.execute({
	name: '  Alice  ',
	age: 30,
	tags: ['typescript'],
})

if (v.isSuccess(result)) {
	console.log(result.value)
}
else {
	console.error(result.issues)
}
```

## Selective imports

```ts
import {
	createValchecker,
	isAtLeast,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({
	steps: [number, isFinite, isAtLeast],
})

const schema = v.number().isFinite().isAtLeast(0)
```

Use `allSteps` when a custom instance should include every built-in plugin.

## Step naming

Valchecker separates API roles through naming:

- initial steps are nouns: `string()`, `number()`, `object()`, `looseBigint()`,
- built-in validations use `isXxx()`: `isInteger()`, `isStartingWith()`, `isLengthAtLeast()`,
- concrete transformations use `toXxx()`: `toTrimmed()`, `toNumber()`, `toJSONValue()`,
- generic escape hatches remain `check()` and `transform()`.

This makes the valid next operations discoverable through editor autocomplete.

## Type-aligned primitives

Primitive initial steps match TypeScript primitive types. `number()` accepts every JavaScript number, including `NaN`, `Infinity`, and `-Infinity`.

```ts
v.number().execute(Number.NaN) // { value: NaN }
v.number().execute(Infinity) // { value: Infinity }
```

Use explicit validation when the application requires a narrower runtime domain:

```ts
v.number().isFinite()
v.number().isInteger()
v.number().isFinite().isAtLeast(0).isAtMost(100)
```

## Loose primitives

Loose primitives accept the primitive itself or its matching TypeScript template-literal representation, then normalize the output:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

Their input contracts correspond to:

```ts
type LooseNumberInput = number | `${number}`
type LooseBooleanInput = boolean | `${boolean}`
type LooseBigintInput = bigint | `${bigint}`
```

They do not perform unrestricted JavaScript coercion. For example, `looseBoolean()` rejects `'TRUE'`, `1`, and arbitrary truthy values.

## Built-in validations

```ts
v.string().isEmpty()
v.string().isNotEmpty()
v.string().isStartingWith('prefix')
v.string().isEndingWith('.json')
v.string().isLengthAtLeast(3).isLengthAtMost(20)

v.array(v.string()).isLengthAtLeast(1)

v.number().isFinite()
v.number().isNaN()
v.number().isInteger()
v.number().isAtLeast(0).isAtMost(100)
```

`isAtLeast()` and `isAtMost()` apply to numbers and bigints. Length constraints are intentionally separate and explicit.

## Primitive conversions

Native coercion steps delegate directly to JavaScript and are exposed only after a different primitive type:

```ts
v.string().toNumber() // Number(value)
v.string().toBoolean() // Boolean(value)
v.string().toBigint() // BigInt(value), with native exceptions as issues
```

They do not hide extra safety policy:

```ts
v.string().toNumber().execute('invalid') // { value: NaN }
v.string().toBoolean().execute('false') // { value: true }
v.bigint().toNumber().execute(9007199254740993n)
// { value: 9007199254740992 }
```

Explicit policy conversions are separate:

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

Identity conversions such as `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware API.

## Other transformations

```ts
v.string().toTrimmed()
v.string().toLowercase()
v.string().toSplit(',')
v.string().toJSONValue()
v.unknown().toJSONString()
v.array(v.number()).toSorted()
```

Use `transform()` for arbitrary output transformations:

```ts
v.string().transform(value => ({ value }))
```

## Custom validation

Use `check()` as the generic validation escape hatch:

```ts
const positive = v.number().check(
	value => value > 0,
	'Must be positive',
)
```

Callbacks may be synchronous or asynchronous according to the individual step contract.

## Results

Successful execution returns the final transformed value:

```ts
type Success<T> = { value: T }
```

Failure returns structured issues:

```ts
type Failure<Issue> = { issues: Issue[] }

interface Issue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

Use `v.isSuccess(result)` and `v.isFailure(result)` as result type guards.

## Documentation

See the complete documentation and semantic contract at the [Valchecker documentation site](https://deviltea.github.io/valchecker/).

## License

MIT
