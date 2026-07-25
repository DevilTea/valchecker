# Common Patterns

## Forms and request objects

Normalize before validating and map issues by `path`, not by parsing messages:

```ts
const form = v.object({
	email: v.string().toTrimmed().toLowercase().isNotEmpty().isEmail(),
	password: v.string().isLengthAtLeast(8),
	confirmation: v.string(),
}).check(
	value => value.password === value.confirmation,
	{ message: 'Passwords must match' },
)
```

Use `strictObject()` to reject unknown input keys, `object()` to omit them from output, and `looseObject()` to preserve them.

## Query strings and configuration

Use loose primitives only when their documented grammar matches the boundary:

```ts
const query = v.object({
	page: v.looseNumber().isFinite().isInteger().isAtLeast(1).fallback(() => 1),
	includeArchived: [v.looseBoolean()],
	search: [v.string().toTrimmed()],
})
```

`fallback()` handles earlier validation and operation failures. Internal issues bypass it. Validate fallback output with later steps or `use()` when the replacement needs proof.

## JSON parsing

```ts
const configFromJSON = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.use(configSchema)
```

`toJSONValue<T>()` can assert a parsed type but does not validate that structure.

## Collections

```ts
const values = v.array(v.number().isFinite())
	.toFiltered(value => value > 0)
	.toSorted({ compareFn: (a, b) => a - b })
```

Set and Map schema children can transform members. Duplicate transformed Set items or Map keys fail instead of silently losing data. Collection callback transforms snapshot the collection when the step starts.

## Branching

Use `union()` for ordered validation fallback. Put common/cheap branches first only when doing so preserves intended semantics. Use `variant()` when an own discriminator directly selects one branch.

## Reuse and async work

Schemas are immutable and reusable. Construct them once outside hot loops. A callback-driven schema may fail synchronously before async work is reached; add `.toAsync()` only where callers require an unconditional native promise.
