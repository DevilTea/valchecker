# Type Inference

Valchecker tracks input, transformed output, issue, and execution-mode types through every pipeline step.

## Input and output helpers

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'

const schema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	count: v.looseNumber().isFinite().isInteger(),
})

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

Use the semver-covered `@valchecker/internal` root for advanced type helpers.

## Primitive and loose primitive outputs

```ts
const strictNumber = v.number()
const looseNumber = v.looseNumber()
const looseBoolean = v.looseBoolean()
const looseBigint = v.looseBigint()
```

Their outputs are respectively `number`, `number`, `boolean`, and `bigint`. Loose string representations are normalized and do not remain in the output union.

## Optional object fields

A one-element tuple marks a field optional:

```ts
const user = v.object({
	name: v.string(),
	nickname: [v.string()],
	tags: [v.array(v.string())],
})

type User = InferOutput<typeof user>
// {
//   name: string
//   nickname: string | undefined
//   tags: string[] | undefined
// }
```

The declared output property is present with `undefined` when the input property is absent.

## Transformations change output types

```ts
const count = v.string()
	.toSplit(',')
	.toFiltered(value => value.length > 0)
	.toLength()

type CountInput = InferInput<typeof count> // string
type CountOutput = InferOutput<typeof count> // number
```

Generic transformations also update inference:

```ts
const record = v.string()
	.transform(value => ({ raw: value }))

type RecordOutput = InferOutput<typeof record>
// { raw: string }
```

## JSON parsing

```ts
const asserted = v.string()
	.toJSONValue<{ name: string }>()
```

The generic parameter asserts an output type; it does not validate the parsed structure. Delegate to another schema for runtime validation:

```ts
const validated = v.string()
	.toJSONValue()
	.use(v.object({
		name: v.string(),
	}))
```

## Built-in validations preserve output types

```ts
const quantity = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
```

The output remains `number`. Runtime refinements such as finite, non-empty, email-like, or bounded values generally cannot be represented as distinct TypeScript primitives unless a custom type guard provides a branded subtype.

## Type-guard checks

```ts
interface EmailBrand {
	readonly __email: unique symbol
}

type Email = string & EmailBrand

function isEmail(value: string): value is Email {
	return value.includes('@')
}

const email = v.string().check(isEmail)
type EmailOutput = InferOutput<typeof email> // Email
```

## Structural inference

```ts
const event = v.union([
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

type Event = InferOutput<typeof event>
```

Union output is the union of branch outputs. Intersection output follows the compatible composed branch outputs.

## Delegation with `use()`

`use()` accepts another Valchecker schema and preserves its transformed output and issue types:

```ts
const normalizedName = v.string()
	.toTrimmed()
	.isNotEmpty()

const delegated = v.unknown().use(normalizedName)
type DelegatedOutput = InferOutput<typeof delegated> // string
```

Use `transform()` rather than `use()` for an arbitrary callback transformation.

## Async schemas

Async work changes execution mode, not successful output:

```ts
const username = v.string().check(async (value) => {
	const exists = await checkExists(value)
	return exists ? 'Already exists' : true
})

type UsernameOutput = InferOutput<typeof username> // string
```

An earlier synchronous failure may bypass the asynchronous callback. Append `.toAsync()` when the schema must always return a native promise.

## Result narrowing

```ts
const result = await schema.execute(input)

if (v.isSuccess(result)) {
	const output: Output = result.value
}
else {
	for (const issue of result.issues)
		console.log(issue.code, issue.path, issue.payload)
}
```

Prefer the exported result guards over ad hoc casts.

## Guidance

- Infer from reusable schemas instead of duplicating interface declarations.
- Treat `toJSONValue<T>()` and `as<T>()` as assertions, not runtime proof.
- Use `check()` type-guard overloads when a runtime predicate genuinely establishes a narrower type.
- Keep transformations explicit so input and output types remain understandable at each chain position.