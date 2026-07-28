<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# Structures

Structural validators compose nested schemas and prepend property keys or collection indexes to child issue paths without mutating child issues.

The normative edge-case behavior is defined in the [Valchecker 1.0 Contract](/guide/v1-contract#object-schemas).

<!-- typecheck-prelude
declare const createValchecker: typeof import('valchecker').createValchecker
declare const union: typeof import('valchecker').union
declare const literal: typeof import('valchecker').literal
declare const null_: typeof import('valchecker').null_
declare const undefined_: typeof import('valchecker').undefined_
declare const number: typeof import('valchecker').number
declare const isGreaterThan: typeof import('valchecker').isGreaterThan
-->

## Issue collection

`object()`, `strictObject()`, `looseObject()`, `array()`, `tuple()`, `set()`, `map()`, `record()`, and `intersection()` stop after the first recoverable structural or child failure by default. A failing child can still contribute every issue produced by that child execution; later sibling fields, items, entries, or intersection branches are not evaluated.

Set `collectAllIssues: true` on the structural step to continue after recoverable failures:

```ts
const form = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })
```

Internal issues are always fatal and stop later structural work in both modes. The option is resolved when the schema is constructed, so the hot traversal loop does not repeatedly branch on it.

`collectAllIssues` does not apply to `union()` or `variant()`, which select a branch rather than traversing siblings.

## Object schemas

### `looseObject(shape, options?)` {#looseObject}

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

### `object(shape, options?)` {#object}

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

### `strictObject(shape, options?)` {#strictObject}

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

### Optional fields

Wrap a schema in a one-element tuple:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.number()],
})
```

The input property may be absent. The declared output property is `undefined` when absent.

This one-element-array shorthand is scoped to object property position. It does not collide with `tuple()`, whose argument is the whole element array; a one-element `tuple([schema])` is a 1-tuple, never an optional field.

### Safe `__proto__` fields

A declared `__proto__` key is written as an own enumerable data property. Valchecker does not invoke the legacy prototype setter. `record()` writes an own `__proto__` key the same way.

## Collections

### `array(elementSchema, options?)` {#array}

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

### `map({ key, value, message?, collectAllIssues? })` {#map}

Validates Map keys and values in insertion order and returns a new Map containing their transformed
outputs. The key schema, value schema, enclosing message, and issue-collection policy are supplied
through one configuration object.

```ts
const scores = v.map({
	key: v.string()
		.toTrimmed(),
	value: v.number()
		.isFinite(),
})

scores.execute(new Map([
	[' Alice ', 100],
	[' Bob ', 90],
]))
// { value: new Map([['Alice', 100], ['Bob', 90]]) }
```

For each entry, the key schema executes before the value schema. In the default mode, a key failure
skips that entry's value and stops later entries; a value failure also stops later entries. With
`collectAllIssues: true`, a recoverable key failure does not hide a value failure from the same
entry, and later entries are still checked. An internal key issue stops before the current value
schema, and any internal child issue stops later entries.

Entries are consumed lazily from the native Map iterator, so a first-issue short-circuit never scans
the remaining entries and a child step that mutates the input Map during validation observes the same
live iteration as the underlying Map iterator. Iteration goes through `Map.prototype.entries` rather
than through the instance, so an overridden `entries`, `forEach`, or `size` cannot redirect
validation away from the Map's actual entries. Fully synchronous key and value schemas keep the Map
schema synchronous; reached thenables continue sequentially.

The output is always a new Map, so the input is never mutated — not even when every key and value
maps to itself.

If two successful source keys transform to the same value under the native Map SameValueZero
comparison, `map:duplicate_transformed_key` is returned instead of applying last-write-wins data
loss.

The configuration's `message` participates in normal structure message resolution for both owned and
nested child issues, after their collection paths are prepended.

**Issues:**

- `map:expected_map` — the value is not a `Map`. Payload `{ value }`.
- `map:duplicate_transformed_key` — two entries produced the same transformed key. Payload
  `{ value, firstSourceKey, sourceKey, transformedKey, firstIndex, index }`, at path
  `[index, 'key']`.
- key-schema issues, with `[index, 'key']` prepended to their paths.
- value-schema issues, with `[index, 'value']` prepended to their paths.

### `record({ key, value, message?, collectAllIssues? })` {#record}

Validates and transforms every own enumerable entry of an object, aligning with TypeScript's
`Record<K, V>`. The key schema, value schema, enclosing message, and issue-collection policy are
supplied through one configuration object.

The key schema's output domain decides the mode:

- **Open domain** (`string`, `number`, `symbol`, template literal): the key schema runs on every own
  enumerable key, and transformed keys must remain unique. Output is an index signature such as
  `{ [k: string]: V }`.
- **Finite domain** (a `literal`, a union of literals, or `isOneOf` — a key schema that advertises a
  finite member set): the record is CLOSED and EXHAUSTIVE. Every member key is required, extra keys
  are rejected, and the key schema is never executed. Output is an all-required mapped object such as
  `{ a: V, b: V }`, matching `Record<'a' | 'b', V>`.

```ts
const ratings = v.record({ key: v.string(), value: v.number() })
ratings.execute({ a: 1, b: 2 })
// { value: { a: 1, b: 2 } }

const flags = v.record({ key: v.union(['read', 'write']), value: v.boolean() })
// output: { read: boolean, write: boolean }
```

Numeric members canonicalize to string keys (`1` becomes `'1'`), matching `Record<1 | '1', V>`, and
two members that collapse to the same property key are one required key. A transformed key from an
open-domain key schema is canonicalized the same way. Own `__proto__` keys are written as safe own
data properties. Inherited and non-enumerable keys are ignored.

A non-object, `null`, or array input fails classification before any entry is read.

In the open domain, each entry runs its key schema before its value schema. In the default mode a key
failure skips that entry's value and stops later entries, and a value failure also stops later
entries. With `collectAllIssues: true` both are collected and later entries are still checked, and a
failed key never reserves its transformed key for a later entry to collide with.

In the finite domain, unknown-key detection happens before member validation and reports every
unknown key in one issue. In the default mode that issue is returned immediately; with
`collectAllIssues: true` the members are validated afterward, and their missing-key and value issues
are appended in member order.

An internal child issue always stops later work, in both modes and under both policies.

The configuration's `message` participates in normal structure message resolution for both owned and
nested child issues, after their paths are prepended.

**Issues:**

- `record:expected_object` — the value is not a non-null, non-array object. Payload `{ value }`.
- `record:missing_key` (finite domain, a member key is absent) — payload `{ key }`, at path `[key]`.
- `record:unexpected_keys` (finite domain, keys outside the member set) — payload
  `{ keys, expectedKeys }`, at path `[]`.
- `record:duplicate_transformed_key` (open domain, two source keys collapse to one transformed key) —
  payload `{ value, firstSourceKey, sourceKey, transformedKey }`, at path `[transformedKey]` after
  canonicalization.
- key-schema issues (open domain only), with `[sourceKey]` prepended and a
  `{ type: 'record', part: 'key' }` context entry.
- value-schema issues, with `[sourceKey]` prepended.

### `set(itemSchema, options?)` {#set}

Validates Set items in insertion order and returns their transformed outputs in a new Set. The input
Set is not mutated, and the output is a new Set even when every item maps to itself.

```ts
const tags = v.set(
	v.string()
		.toTrimmed()
		.toLowercase(),
)

tags.execute(new Set([' TS ', 'Vue']))
// { value: new Set(['ts', 'vue']) }
```

Items are consumed lazily from the native Set iterator, so a first-issue short-circuit never scans
the remaining items and a child step that mutates the input Set during validation observes the same
live iteration as the underlying Set iterator. Iteration goes through `Set.prototype.values` rather
than through the instance, so an overridden `values` cannot redirect validation away from the Set's
actual items. Fully synchronous child schemas keep the Set schema synchronous; after a reached
thenable, remaining items continue sequentially in insertion order.

By default, the first recoverable item or transformed-item collision stops traversal.
`collectAllIssues: true` preserves complete recoverable issue collection, while an internal child
issue always stops later items.

If two source items transform to the same value under the native Set SameValueZero comparison,
`set:duplicate_transformed_item` is returned instead of silently reducing Set cardinality.

The options `message` participates in normal structure message resolution for both owned and nested
child issues, after their `[index]` paths are prepended.

**Issues:**

- `set:expected_set` — the value is not a `Set`. Payload `{ value }`.
- `set:duplicate_transformed_item` — two items produced the same transformed value. Payload
  `{ value, firstItem, item, transformedItem, firstIndex, index }`, at path `[index]`.
- item-schema issues, with `[index]` prepended to their paths.

### `tuple(elements, options?)` {#tuple}

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

## Composition

### `intersection(schemas, options?)` {#intersection}

Executes every branch and composes compatible outputs. By default, branches execute in declaration
order and the first failing branch stops later branch evaluation. With `collectAllIssues: true`,
recoverable branch failures are collected; after the first asynchronous branch is reached, remaining
branches start together.

```ts
const timestamped = v.object({
	createdAt: v.number(),
	updatedAt: v.number(),
})

const auditable = v.object({
	createdBy: v.string(),
	updatedBy: v.string(),
})

const entity = v.intersection([timestamped, auditable])
```

Only plain objects are recursively composed. Enumerable string and symbol keys, compatible cycles,
and shared-reference topology are supported.

Equal primitives and the same non-plain reference are preserved. Distinct `Date`, `Map`, class, or
other non-plain instances conflict.

Output merging runs only when all branches succeed. Merge conflicts are singular structural failures
because no later branch validation remains to collect.

**Issue code:** `intersection:conflicting_outputs` — two branch outputs cannot be merged. Payload
`{ path, leftBranch, rightBranch, leftValue, rightValue, reason }`, where `path` is the graph path
to the conflict, `leftBranch` and `rightBranch` are the branch indexes, and `reason` is one of
`'different_values'`, `'different_references'`, `'incompatible_alias'`, `'incompatible_cycle'`, or
`'incompatible_prototype'`.

### `union(branches)` {#union}

Evaluates branches in declaration order and returns the first successful branch's transformed
output.

```ts
const identifier = v.union([
	v.string()
		.toTrimmed()
		.transform(value => value.length),
	v.number()
		.isFinite()
		.isInteger()
		.isAtLeast(0),
])

identifier.execute(' abc ')
// { value: 3 }
```

If every branch fails, the result contains collected branch issues. Branch order can affect output
and performance. `collectAllIssues` does not apply to `union()`; its first-success and
all-branches-failed diagnostics remain unchanged.

**Issues:** `union` owns no issue code. Every failed branch's issues are aggregated, each carrying a
non-data `{ type: 'union', branchIndex }` context entry. An internal branch issue stops branch
evaluation immediately, and only that branch's issues are returned — the issues collected from
earlier branches are dropped.

#### Registration-aware shorthand

Initial-schema steps can extend the values accepted directly by `union()` when they are registered
in the same Valchecker instance:

| Registered step | Enabled shorthand |
| --- | --- |
| `literal` | `string`, `number`, `bigint`, `boolean`, and `symbol` literal values |
| `null_` | `null` |
| `undefined_` | `undefined` |

<!-- typecheck-isolate -->
```ts
const v = createValchecker({
	steps: [union, literal, null_, undefined_, number, isGreaterThan],
})

const value = v.union([
	'auto',
	0,
	null,
	undefined,
	v.number()
		.isGreaterThan(0),
])
```

The shorthand form is normalized during schema construction through the registered provider step.
For example, `'auto'`, `null`, and `undefined` are equivalent to `v.literal('auto')`, `v.null()`,
and `v.undefined()` respectively. They retain the provider's output, issue code, payload, message
resolution, and equality semantics; `union()` does not implement a second primitive validator.

Shorthand availability follows the steps registered on that specific instance. Importing a provider
without registering it does not enable its shorthand. Registration order does not matter.

Use an explicit provider schema when a branch needs provider-specific options such as a custom
message:

```ts
const value = v.union([
	v.literal('auto', { message: 'Expected automatic mode.' }),
	v.null({ message: 'Expected null.' }),
])
```

#### Discriminated unions

```ts
const event = v.union([
	v.object({
		type: v.literal('click'),
		x: v.number(),
		y: v.number(),
	}),
	v.object({
		type: v.literal('keypress'),
		key: v.string(),
	}),
])
```

Literal fields and ordered object branches provide discriminated-union behavior without a separate
primitive.

### `variant(options)` {#variant}

Reads one own discriminator property, performs direct property-key lookup, and executes only the
selected branch.

```ts
const event = v.variant({
	discriminator: 'type',
	variants: {
		click: v.object({
			type: v.literal('click'),
			x: v.number(),
			y: v.number(),
		}),
		keypress: v.object({
			type: v.literal('keypress'),
			key: v.string(),
		}),
	},
})
```

Inputs must be non-null, non-array objects. The discriminator must be an own property whose value is
a configured string, number, or symbol property key. Number and string values follow JavaScript
property-key canonicalization, so `1` and `'1'` select the same object-key branch.

Variant maps are non-empty schema-time snapshots. Child issue paths remain unchanged and receive
`{ type: 'variant', discriminator, discriminatorValue }` context. A variant-level `message` is an
enclosing structure scope; an originating child-step message retains priority.

If every branch is synchronous, the schema is synchronous. Otherwise selection remains maybe-async
because invalid discriminators can still fail synchronously. Unselected branches never execute.

**Issue codes:**

- `variant:expected_object` — the value is not a non-null, non-array object. Payload `{ value }`.
- `variant:invalid_discriminator` — the own discriminator property is absent, or its value is not
  a configured variant key. Payload `{ value, discriminator, received, expected }`, with the
  discriminator as the issue path.

Issues from the selected branch are returned as they are.

## Class and binary instances

### `blob(options?)` {#blob}

Checks that the value is a `Blob`, preserving the value and inferring the `Blob` output type. Every
`File` is also a `Blob`, so `blob()` accepts both.

The global `Blob` constructor is feature-detected. In an environment without `Blob` (such as some
server runtimes), the schema fails with its owned issue instead of throwing.

```ts
const upload = v.blob()

upload.execute(new Blob(['data'])) // success
upload.execute(new File(['data'], 'a.png')) // success
upload.execute('a.png') // failure
```

**Issue code:** `blob:expected_blob` — the value is not a `Blob`. Payload `{ value }`.

### `file(options?)` {#file}

Checks that the value is a `File`, preserving the value and inferring the `File` output type.

The global `File` constructor is feature-detected. In an environment without `File` (such as some
server runtimes), the schema fails with its owned issue instead of throwing.

```ts
const avatar = v.file()

avatar.execute(new File(['data'], 'a.png')) // success
avatar.execute('a.png') // failure
```

Size validation reuses the collection size steps because `File` and `Blob` expose a numeric `size`:

```ts
v.file()
	.isSizeAtMost(5 * 1024 * 1024) // at most 5 MiB
```

**Issue code:** `file:expected_file` — the value is not a `File`. Payload `{ value }`.

### `instance(constructor, options?)` {#instance}

Validates with `instanceof`, and infers the constructor's instance type as the output.

```ts
const dateSchema = v.instance(Date)

dateSchema.execute(new Date()) // success
dateSchema.execute('2026-01-01') // failure
```

**Issue code:** `instance:expected_instance` — the value is not an instance of the expected class.
Payload `{ value, expected }`, where `expected` is the configured constructor.

## Collection size and membership

Map, Set, `File`, and `Blob` outputs expose numeric `size`, so size validation is shared across them. Size-validation failures snapshot the single observed `size` value; the string and array emptiness and length validations keep their `length` payloads instead.

A Map or Set output therefore offers [`isEmpty()`](/api/primitives#isEmpty), [`isNotEmpty()`](/api/primitives#isNotEmpty), `isSizeAtLeast()`, `isSizeAtMost()`, `isSizeExactly()`, and [`toSize()`](/api/transforms#toSize). The first two live on [Primitives](/api/primitives) because they read a string or an array as readily as a collection.

Every membership form uses SameValueZero equality, so `NaN` matches `NaN` and `0` matches `-0`. Set membership reuses [`isIncluding()`](/api/primitives#isIncluding); Map membership is explicit about the searched domain.

### `isIncludingKey(key, options?)` {#isIncludingKey}

Checks that a Map includes the configured key, searching the Map's keys through
`Map.prototype.has()`. The successful value is preserved.

```ts
const withPrimary = v.map({ key: v.string(), value: v.number() })
	.isIncludingKey('primary')

withPrimary.execute(new Map([['primary', 1]])) // success
withPrimary.execute(new Map([['secondary', 1]])) // failure
```

**Issue code:** `isIncludingKey:expected_including_key` — the Map has no such key. Payload
`{ value, expectedKey }`.

### `isIncludingValue(value, options?)` {#isIncludingValue}

Checks that a Map includes the configured value, searching the Map's entry values with SameValueZero
equality. The successful value is preserved.

```ts
const withScoreOne = v.map({ key: v.string(), value: v.number() })
	.isIncludingValue(1)

withScoreOne.execute(new Map([['primary', 1]])) // success
withScoreOne.execute(new Map([['primary', 2]])) // failure
```

**Issue code:** `isIncludingValue:expected_including_value` — no entry value equals the configured
value. Payload `{ value, expectedValue }`.

### `isSizeAtLeast(minimumSize, options?)` {#isSizeAtLeast}

Checks that the observed `size` is greater than or equal to the minimum. It is available after any
output that exposes a numeric `size`, and preserves the successful value.

```ts
const atLeastOne = v.set(v.string())
	.isSizeAtLeast(1)

atLeastOne.execute(new Set(['a'])) // success
atLeastOne.execute(new Set()) // failure
```

**Issue code:** `isSizeAtLeast:expected_size_at_least` — the observed size is below the minimum.
Payload `{ value, minimumSize, size }`.

### `isSizeAtMost(maximumSize, options?)` {#isSizeAtMost}

Checks that the observed `size` is less than or equal to the maximum. It is available after any
output that exposes a numeric `size`, and preserves the successful value — an upload size limit is
`v.file().isSizeAtMost(bytes)`.

```ts
const atMostTwo = v.map({ key: v.string(), value: v.number() })
	.isSizeAtMost(2)

atMostTwo.execute(new Map([['a', 1]])) // success
atMostTwo.execute(new Map([['a', 1], ['b', 2], ['c', 3]])) // failure
```

**Issue code:** `isSizeAtMost:expected_size_at_most` — the observed size exceeds the maximum.
Payload `{ value, maximumSize, size }`.

### `isSizeExactly(expectedSize, options?)` {#isSizeExactly}

Checks that the observed `size` equals the expected size. It is available after any output that
exposes a numeric `size`, and preserves the successful value.

```ts
const exactlyTwo = v.set(v.number())
	.isSizeExactly(2)

exactlyTwo.execute(new Set([1, 2])) // success
exactlyTwo.execute(new Set([1])) // failure
```

**Issue code:** `isSizeExactly:expected_size_exactly` — the observed size is not exactly the
expected size. Payload `{ value, expectedSize, size }`.

```ts
const tags = v.set(v.string())
	.isNotEmpty()
	.isSizeAtMost(5)
	.isIncluding('required')

const scoreCount = v.map({ key: v.string(), value: v.number() })
	.isIncludingKey('primary')
	.isIncludingValue(1)
	.toSize()
```

## Media types

Matching a value's declared `type` is neither a size nor a membership check, so it sits on its own: it compares strings rather than values, and none of the equality rules above apply to it.

### `isMimeType(types, options?)` {#isMimeType}

Checks that a value's `type` string matches one of the allowed MIME types. Pass a single type or a
list. A trailing `/*` matches any subtype, and matching is case-insensitive following MIME
semantics. The successful value is preserved. Any output with a `type` string qualifies, including
`File` and `Blob`.

Matching compares the bare `type/subtype` only and does not parse MIME parameters: `text/plain` does
not match `text/plain;charset=utf-8`, though a `text/*` wildcard would. An empty type list throws a
`TypeError` during schema construction.

```ts
v.file()
	.isMimeType(['image/*', 'application/pdf'])
	.execute(new File(['data'], 'a.png', { type: 'image/png' })) // success
```

**Issue code:** `isMimeType:unexpected_mime_type` — the value's `type` matches no allowed MIME
type. Payload `{ value, expected, actual }`, where `expected` is the configured type or list and
`actual` is the observed `type`.

## Nested issue paths

```ts
const schema = v.object({
	users: v.array(
		v.object({
			profile: v.object({
				name: v.string(),
			}),
		}),
	),
})
```

A failure in the second user's name receives path `['users', 1, 'profile', 'name']`. Symbols remain symbol path segments. Frozen or reused child issues are supported because path prepending clones rather than mutates.
