<!-- step-doc
category: structures
section: objects
summary: declared own properties validated, unknown own string and symbol keys rejected
-->

### `strictObject(shape, options?)`

Validates declared own fields and rejects unknown enumerable own string and symbol keys.

```ts
const point = v.strictObject({
	x: v.number(),
	y: v.number(),
})

point.execute({ x: 1, y: 2 })
// { value: { x: 1, y: 2 } }

point.execute({ x: 1, y: 2, z: 3 })
// failure, payload { keys: ['z'], expectedKeys: ['x', 'y'] }
```

Unknown-key detection happens before declared-field validation, and one scan reports every unknown
key: the single `strictObject:unexpected_keys` issue contains the complete unknown-key list. With
default issue collection, that issue is returned immediately; with `collectAllIssues: true`, declared
fields are validated afterward and their issues are appended in shape order.

Inherited values do not satisfy declared fields, and an inherited key is not an unknown key: both
scans read own properties only. An own property whose value is `undefined` is present, and is passed
to its child schema rather than reported as missing.

**Issues:**

- `strictObject:expected_object` — the value is not a non-null, non-array object. Payload
  `{ value }`.
- `strictObject:missing_key` — a declared required key is not an own property. Payload `{ key }`, at
  path `[key]`.
- `strictObject:unexpected_keys` — the value carries own keys the shape does not declare. Payload
  `{ keys, expectedKeys }`, at path `[]`.
- issues from declared field schemas, with the property key prepended to their paths.
