<!-- step-doc
category: helpers
section: flow-control
summary: delegate to another schema
-->

### `use(schema)`

Delegates the current value to another Valchecker schema while preserving the delegated transformed
output, issue types, paths, and execution mode.

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
