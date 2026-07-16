# Basic Validation

This example covers primitives, explicit constraints, objects, arrays, unions, transformations, and inferred outputs.

## Setup

```ts
import type { InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'
```

## Primitive identity

```ts
v.string().execute('Alice') // success
v.boolean().execute(true) // success
v.bigint().execute(42n) // success
v.number().execute(Number.NaN) // success
v.number().execute(Infinity) // success
```

Primitive initial schemas align with TypeScript identities. Add explicit validations for narrower runtime domains.

## String validation and normalization

```ts
const username = v.string()
	.toTrimmed()
	.toLowercase()
	.isNotEmpty()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)

username.execute('  Alice_123  ')
// { value: 'alice_123' }
```

Prefix and suffix constraints are also explicit:

```ts
const configFile = v.string()
	.isStartingWith('config')
	.isEndingWith('.json')
```

## Number validation

```ts
const age = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(0)
	.isAtMost(150)

age.execute(25) // success
age.execute(-5) // failure
age.execute(3.14) // failure
age.execute(Infinity) // failure
```

Each constraint checks only its named condition:

```ts
v.number().isAtLeast(0).execute(Infinity) // success
v.number().isFinite().isAtLeast(0).execute(Infinity) // failure
```

## Loose primitive input

```ts
const query = v.object({
	page: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(1),
	includeArchived: v.looseBoolean(),
	cursor: [v.looseBigint()],
})

query.execute({
	page: '2',
	includeArchived: 'false',
	cursor: '0x10',
})
// {
//   value: {
//     page: 2,
//     includeArchived: false,
//     cursor: 16n,
//   },
// }
```

Loose primitives accept TypeScript-compatible string representations, not unrestricted JavaScript coercion.

## Object validation

```ts
const user = v.object({
	id: v.string().isNotEmpty(),
	name: v.string().toTrimmed().isNotEmpty(),
	email: v.string().toLowercase(),
	age: [v.number().isFinite().isInteger().isAtLeast(0)],
})

const result = user.execute({
	id: 'user-1',
	name: '  Alice  ',
	email: 'ALICE@EXAMPLE.COM',
})
```

A one-element tuple marks a field optional. The output includes the declared property with `undefined` when absent.

## Object variants

```ts
const shape = {
	name: v.string().toTrimmed(),
}

v.object(shape) // unknown properties omitted from output
v.strictObject(shape) // unknown own enumerable keys rejected
v.looseObject(shape) // unknown own properties preserved
```

Declared properties are read from own properties only.

## Array validation

```ts
const tags = v.array(v.string().toLowercase())
	.isNotEmpty()
	.isLengthAtMost(10)

const coordinates = v.array(v.number().isFinite())
	.isLengthAtLeast(2)
	.isLengthAtMost(2)
```

Array transformations remain available after validation:

```ts
const positiveSorted = v.array(v.number().isFinite())
	.toFiltered(value => value > 0)
	.toSorted((a, b) => a - b)

positiveSorted.execute([3, -1, 2])
// { value: [2, 3] }
```

## Nested structures

```ts
const orderItem = v.object({
	productId: v.string().isNotEmpty(),
	quantity: v.number()
		.isFinite()
		.isInteger()
		.isAtLeast(1),
	price: v.number()
		.isFinite()
		.isAtLeast(0),
})

const order = v.object({
	id: v.string().isNotEmpty(),
	items: v.array(orderItem).isNotEmpty(),
	total: v.number().isFinite().isAtLeast(0),
})
```

Nested failures prepend object keys and array indices to issue paths.

## Union validation

```ts
const identifier = v.union([
	v.string().isNotEmpty(),
	v.number().isFinite().isInteger().isAtLeast(1),
])

const event = v.union([
	v.object({
		type: v.literal('click'),
		x: v.number().isFinite(),
		y: v.number().isFinite(),
	}),
	v.object({
		type: v.literal('keypress'),
		key: v.string().isNotEmpty(),
	}),
])
```

Branches run in declaration order. The first successful branch's transformed output is returned.

## Literal unions

```ts
const status = v.union([
	v.literal('pending'),
	v.literal('active'),
	v.literal('completed'),
	v.literal('cancelled'),
])

type Status = InferOutput<typeof status>
// 'pending' | 'active' | 'completed' | 'cancelled'
```

## JSON input

```ts
const config = v.string()
	.toJSONValue()
	.use(v.object({
		port: v.number()
			.isFinite()
			.isInteger()
			.isAtLeast(1)
			.isAtMost(65535),
	}))
```

`toJSONValue<T>()` can assert an output type, but `use()` performs actual structural validation.

## Generic validation and transformation

Use named steps when they precisely describe the operation. Use the generic escape hatches otherwise:

```ts
const passwordConfirmation = v.object({
	password: v.string().isLengthAtLeast(8),
	confirmation: v.string(),
}).check(value =>
	value.password === value.confirmation
		|| 'Passwords must match',
)

const record = v.string()
	.transform(value => ({ raw: value }))
```

## Results and inference

```ts
const schema = v.object({
	id: v.looseBigint(),
	name: v.string().toTrimmed().isNotEmpty(),
	tags: [v.array(v.string()).isLengthAtMost(10)],
})

type Output = InferOutput<typeof schema>

const result = await schema.execute(input)

if (v.isSuccess(result)) {
	const value: Output = result.value
}
else {
	for (const issue of result.issues) {
		console.log(issue.code, issue.path, issue.payload)
	}
}
```

## Next steps

- [Async Validation](/examples/async-validation)
- [Custom Messages](/examples/custom-messages)
- [Fallback Chains](/examples/fallback-chains)
- [Issue Paths](/examples/issue-paths)