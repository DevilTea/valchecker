<!-- step-doc
category: structures
section: collections
summary: fixed-shape array with per-position schemas and one optional rest region
-->

### `tuple(elements, options?)`

Validates a fixed-shape array with per-position schemas, aligning with a TypeScript tuple. A single
`'...'` marker declares the NEXT entry as a rest region whose output must be an array; that array is
spread into the result. So `v.array(X)` after `'...'` yields a variadic `...X[]`, and
`v.tuple([A, B])` after `'...'` yields a fixed spread. One rest region is allowed in leading, middle,
or trailing position.

```ts
v.tuple([v.string(), v.number()]) // [string, number]
v.tuple([v.string(), '...', v.array(v.number())]) // [string, ...number[]]
v.tuple([v.string(), '...', v.array(v.boolean()), v.number()]) // [string, ...boolean[], number]

const schema = v.tuple([v.string(), '...', v.array(v.number())])
schema.execute(['id', 1, 2, 3])
// { value: ['id', 1, 2, 3] }
```

The rest region receives the remaining slice as one array value, built by index copy and never via
`Array.prototype.slice`, so a subclass that overrides `slice` cannot corrupt it. Elements are
validated in position order — prefix, then rest region, then suffix — and by default the first
failing element stops later element validation; `collectAllIssues: true` traverses the rest. Fully
synchronous elements keep the tuple synchronous.

A malformed element list is rejected by the type gate, and throws a `TypeError` when the schema is
constructed: two `'...'` markers, a marker with no schema after it, an entry that is not a Valchecker
schema, or an `elements` argument that is not an array.

Optional tuple elements (`[A, B?]`) are not expressible today: TypeScript mapped tuples cannot
conditionally emit `?` slots. Use a union of tuples as the rest to model exactly that shape:

```ts
// [string] | [string, number]
const schema = v.tuple([v.string(), '...', v.union([v.tuple([]), v.tuple([v.number()])])])
```

**Issues:**

- `tuple:expected_array` — the value is not an array. Payload `{ value }`.
- `tuple:unexpected_length` — a rest-less tuple received the wrong length. Payload
  `{ value, expectedLength, length }`.
- `tuple:expected_length_at_least` — a tuple with a rest region received too few elements. Payload
  `{ value, minimumLength, length }`.
- element issues, with the absolute index prepended to their paths.
- rest-region issues, with a numeric path head remapped to its absolute index in the tuple, and a
  `{ type: 'tuple', part: 'rest' }` context entry on every one of them.
