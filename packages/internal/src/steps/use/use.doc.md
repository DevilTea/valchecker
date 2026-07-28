<!-- step-doc
category: helpers
section: flow-control
summary: delegate to another schema
-->

### `use(schema)`

Delegates the current value to another Valchecker schema, keeping the delegated transformed output,
issue types, and paths. Execution mode is kept only when the delegated schema is `'sync'`: every
other delegated mode — including the unconditional `'async'` of a `toAsync()` schema — becomes
`'maybe-async'` here, because `use()` runs the delegate only after the current pipeline succeeds. Call
`toAsync()` on the composed schema when it must always return a native promise.

```ts
const normalizedName = v.string()
	.toTrimmed()
	.isNotEmpty()
	.toLowercase()

const user = v.object({
	name: v.unknown()
		.use(normalizedName),
})
```

JSON parsing plus structural validation is a common pattern:

```ts
const port = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)

const config = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.use(v.object({ port }))
```

This step owns no issue: it reports whatever the delegated schema reports, unchanged.
