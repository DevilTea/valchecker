<!-- step-doc
category: structures
section: collections
summary: every element validated and transformed in index order
-->

### `array(elementSchema, options?)`

Validates elements in index order and returns their transformed outputs in a new array. By default,
the first failing element stops later element validation. Set `collectAllIssues: true` to traverse
the remaining indexes.

```ts
const tags = v.array(v.string()
	.toLowercase())
	.isLengthAtLeast(1)
	.isLengthAtMost(5)

tags.execute(['JS', 'TS', 'NODE'])
// { value: ['js', 'ts', 'node'] }
```

Every index up to the array's `length` is validated, so a sparse position is validated as the
`undefined` value that reading it yields rather than skipped.

Common array steps include `isEmpty`, `isNotEmpty`, `isLengthAtLeast`, `isLengthAtMost`,
`toFiltered`, `toSorted`, `toSliced`, and `toLength`.

**Issues:**

- `array:expected_array` — the value is not an array. Payload `{ value }`.
- element issues, with the numeric index prepended to their paths.
