<!-- step-doc
category: structures
section: objects
summary: declared own properties validated, unknown own properties preserved
-->

### `looseObject(shape, options?)`

Validates declared own fields and preserves unknown own properties in output. It is not an alias
for `object()`, which omits unknown properties from its output, nor for `strictObject()`, which
rejects them.

```ts
const loose = v.looseObject({
	name: v.string()
		.toTrimmed(),
})

loose.execute({
	name: '  Alice  ',
	metadata: { source: 'import' },
})
// {
//   value: {
//     name: 'Alice',
//     metadata: { source: 'import' },
//   },
// }
```

Descriptors of unknown properties are preserved: the output is built from the input's own property
descriptors with the declared keys removed. Declared transformed properties are then materialized as
ordinary writable data properties. Those descriptors are read only once every declared field has
succeeded, so a failing field never pays for them.

Declared fields are read from own properties only, so an inherited value does not satisfy a declared
field. An own property whose value is `undefined` is present, and is passed to its child schema
rather than reported as missing.

Fields are validated in shape order, and by default the first failure stops the later ones. With
`collectAllIssues: true` the remaining fields are still validated and their issues are appended in
shape order.

**Issues:**

- `looseObject:expected_object` — the value is not a non-null, non-array object. Payload
  `{ value }`.
- `looseObject:missing_key` — a declared required key is not an own property. Payload `{ key }`, at
  path `[key]`.
- issues from declared field schemas, with the property key prepended to their paths.
