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

## Map and Set collections

```ts
const tags = v.set(v.string().toTrimmed().toLowercase())
	.isNotEmpty()
	.isSizeAtMost(5)
	.isIncluding('required')

const scoreCount = v.map({
	key: v.string().toTrimmed(),
	value: v.number().isFinite(),
})
	.isIncludingKey('primary')
	.isIncludingValue(1)
	.toSize()
```

Both initial schemas preserve insertion order, return new transformed collections, and expose stable child paths. Duplicate transformed Set items or Map keys are validation failures rather than silent data loss.

Map and Set schemas expose size-aware emptiness checks, `isSizeAtLeast()`, `isSizeAtMost()`, `isSizeExactly()`, and `toSize()`. Set membership uses `isIncluding()`, while Map membership is explicit through `isIncludingKey()` and `isIncludingValue()`.

Use `toArray()` for Set items and `toKeys()`, `toValues()`, or `toEntries()` for explicit Map representations. Each transform returns a new insertion-ordered array and emits no new issue.

Set schemas expose `toMapped()` and `toFiltered()`. Map schemas expose explicit `toMappedKeys()` and `toMappedValues()` transforms. These callbacks traverse a step-start snapshot synchronously; mapped Set items and Map keys must remain unique under SameValueZero.

## Direct variant dispatch

```ts
const event = v.variant({
	discriminator: 'type',
	variants: {
		click: v.object({ type: v.literal('click'), x: v.number(), y: v.number() }),
		keypress: v.object({ type: v.literal('keypress'), key: v.string() }),
	},
})
```

`variant()` reads an own discriminator, uses JavaScript property-key semantics, and executes only the selected branch. Use `union()` when branch selection itself requires ordered validation.

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

## Template literals

`templateLiteral(parts)` validates a string against an assembled TypeScript template-literal type and infers that exact output type, with cross-product union expansion. Matching mirrors the TypeScript checker's placeholder split rule, not a regex.

```ts
v.templateLiteral(['ID-', v.number()]).execute('ID-42') // { value: 'ID-42' }, output `ID-${number}`
v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])]) // output `${number}px` | `${number}em` | `${number}rem`
```

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

`isAtLeast()` and `isAtMost()` apply to numbers and bigints. Length and size constraints are intentionally separate and explicit.

## String formats

Dedicated `isXxx()` validators cover common string formats, each with its own semantic issue code (`isEmail:expected_email`, `isUrl:expected_url`, …):

```ts
v.string().isEmail()
v.string().isUrl() // http/https; override with { protocols: [...] }
v.string().isUuid()
v.string().isIp({ version: 6 })
v.string().isIsoDateTime()
v.string().isJwt()
v.string().isEmoji()
```

Also available: `isHex()`, `isMac()`, `isHostname()`, `isBase64()`, `isBase64Url()`, `isCuid2()`, `isUlid()`, `isNanoid()`, `isIsoDate()`, and `isIsoTime()`. Each is value-preserving and enforces only its named format.

## File and Blob

`file()` and `blob()` validate `File` and `Blob` values with feature-detected globals, so they fail gracefully in environments where the constructors are absent. MIME validation uses `isMimeType()`, and size validation reuses the collection size steps because both expose a numeric `size`.

```ts
v.file()
	.isMimeType(['image/*', 'application/pdf'])
	.isSizeAtMost(5 * 1024 * 1024)

v.blob().isMimeType('application/json')
```

`isMimeType()` matches a single type or a list, supports `image/*`-style wildcards, and compares case-insensitively.

## Primitive conversions

Native coercion steps delegate directly to JavaScript and are exposed after any output that is not already the target primitive type:

```ts
v.string().toNumber() // Number(value)
v.unknown().toBoolean() // Boolean(value)
v.object({ value: v.number() }).toBigint() // BigInt(value), with native exceptions as issues
```

They do not hide extra safety policy:

```ts
v.string().toNumber().execute('invalid') // { value: NaN }
v.string().toBoolean().execute('false') // { value: true }
v.bigint().toNumber().execute(9007199254740993n)
// { value: 9007199254740992 }
```

Native exceptions from `Number()` and `BigInt()` become structured issues. Explicit policy conversions are separate:

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
v.set(v.string()).toSize()
```

Use `transform()` for arbitrary output transformations:

```ts
v.string().transform(value => ({ value }))
```

## Custom validation

Use `check()` as the generic validation escape hatch:

```ts
const positive = v.number().check(value => value > 0, { message: 'Must be positive' }
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
