<!-- step-doc
category: structures
section: objects
summary: declared own properties validated, unknown properties omitted from the output
-->

### `object(shape, options?)`

Validates declared own fields. Unknown input properties do not fail validation, but are omitted from
output.

```ts
const user = v.object({
	id: v.string(),
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	age: [v.number()
		.isFinite()
		.isAtLeast(0)],
})

user.execute({
	id: '123',
	name: '  Alice  ',
	extra: 'ignored',
})
// { value: { id: '123', name: 'Alice', age: undefined } }
```

Inherited values do not satisfy declared fields: every declared key is read as an own property. An
own property whose value is `undefined` is present, and is passed to its child schema rather than
reported as missing.

Fields are validated in shape order, and by default the first failure — a missing required key or a
child issue — stops the later ones. With `collectAllIssues: true` the remaining fields are still
validated and their issues are appended in shape order.

**Issues:**

- `object:expected_object` — the value is not a non-null, non-array object. Payload `{ value }`.
- `object:missing_key` — a declared required key is not an own property. Payload `{ key }`, at path
  `[key]`.
- issues from declared field schemas, with the property key prepended to their paths.
