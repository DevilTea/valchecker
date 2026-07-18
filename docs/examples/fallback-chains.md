# Fallback Chains

Use `fallback()` to recover from earlier pipeline failures with an explicit replacement value.

## JSON payload recovery

```ts
import { v } from 'valchecker'

const payloadSchema = v.string()
	.toJSONValue({ message: 'Invalid JSON format' })
	.fallback(() => ({ items: [] }))
	.use(v.object({
		items: v.array(
			v.object({
				id: v.string().toTrimmed().isNotEmpty(),
				quantity: v.number()
					.isFinite()
					.isInteger()
					.isAtLeast(1),
			}),
		),
	}))
```

Invalid JSON is replaced before structural validation. Valid JSON with an invalid `items` shape still fails at the delegated object schema unless another later fallback is added.

## Configuration defaults

Use loose primitives when configuration values may arrive as strings:

```ts
const configSchema = v.object({
	port: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(1)
		.isAtMost(65535)
		.fallback(() => 3000),
	host: v.string()
		.toTrimmed()
		.isNotEmpty()
		.fallback(() => 'localhost'),
	timeout: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(0)
		.fallback(() => 30000),
})
```

Any earlier failure in a field pipeline triggers its fallback, including initial type failure and later constraint failure.

## Form normalization

```ts
const phone = v.string()
	.toTrimmed()
	.transform(value => value.replace(/\D/g, ''))
	.isLengthAtLeast(10, { message: 'Phone number too short' })
	.fallback(() => '')

const email = v.string()
	.toTrimmed()
	.toLowercase()
	.check(value => value.includes('@'), { message: 'Invalid email format' })
	.fallback(() => null)

const form = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty()
		.fallback(() => 'Anonymous'),
	phone,
	email: [email],
})
```

Fallback output becomes the current successful value and may change the inferred output type.

## Dynamic fallback values

Fallback callbacks receive the issues produced so far:

```ts
const nonNegative = v.number()
	.isAtLeast(0)
	.fallback((issues) => {
		logger.warn('Using numeric fallback', { issues })
		return 0
	})
```

## Multiple recovery boundaries

A later validation may fail after an earlier fallback has recovered:

```ts
const schema = v.string()
	.toJSONValue({ message: 'Step 1: Invalid JSON' })
	.fallback(() => ({}))
	.check((value): value is { items: unknown } =>
			typeof value === 'object'
			&& value !== null
			&& 'items' in value, { message: 'Step 2: Missing items' }
	)
	.fallback(() => ({ items: [] }))
```

Each fallback handles failures accumulated before its own position. It does not guard steps appended later.

## Async fallback

A fallback may return a direct value or supported `PromiseLike` value:

```ts
const profile = v.string()
	.toJSONValue()
	.fallback(async () => {
		return await cache.getDefaultProfile()
	})
```

The invocation becomes asynchronous only when that callback is reached. Append `.toAsync()` when every invocation must return a native promise.

## Guidance

Fallbacks are appropriate for documented defaults, optional configuration, cache recovery, and intentionally lossy input normalization. They can also conceal upstream data defects.

Prefer these practices:

- keep fallback values explicit and type-correct,
- log or measure unexpected recovery paths,
- place fallbacks immediately after the failures they are intended to recover,
- validate fallback output with subsequent named steps or `use()` when necessary,
- do not use fallback as a replacement for critical integrity checks.