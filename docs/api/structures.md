# Structures

Structural validators compose nested schemas and prepend property keys or collection indexes to child issue paths without mutating child issues.

The normative edge-case behavior is defined in the [Valchecker 1.0 Contract](/guide/v1-contract#object-schemas).

## Issue collection

`object()`, `strictObject()`, `looseObject()`, `array()`, `set()`, `map()`, and `intersection()` stop after the first recoverable structural or child failure by default. A failing child can still contribute every issue produced by that child execution; later sibling fields, items, entries, or intersection branches are not evaluated.

Set `collectAllIssues: true` on the structural step to continue after recoverable failures:

```ts
const form = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })
```

Internal issues are always fatal and stop later structural work in both modes. The option is resolved when the schema is constructed, so the hot traversal loop does not repeatedly branch on it.

## `object(shape, options?)`

Validates declared own fields. Unknown input properties do not fail validation, but are omitted from output.

**Issues:**

- `object:expected_object`
- `object:missing_key`
- issues from declared field schemas

```ts
const user = v.object({
	id: v.string(),
	name: v.string().toTrimmed().isNotEmpty(),
	age: [v.number().isFinite().isAtLeast(0)],
})

user.execute({
	id: '123',
	name: '  Alice  ',
	extra: 'ignored',
})
// { value: { id: '123', name: 'Alice', age: undefined } }
```

Inherited values do not satisfy declared fields.

## `strictObject(shape, options?)`

Validates declared own fields and rejects unknown enumerable own string and symbol keys.

**Issues:**

- `strictObject:expected_object`
- `strictObject:missing_key`
- `strictObject:unexpected_keys`
- issues from declared field schemas

Unknown-key detection happens before declared-field validation. The single `strictObject:unexpected_keys` issue still contains the complete unknown-key list. With default issue collection, that issue is returned immediately; with `collectAllIssues: true`, declared fields are validated afterward and their issues are appended in shape order.

## `looseObject(shape, options?)`

Validates declared own fields and preserves unknown own properties in output. It is not an alias for `object()`.

```ts
const loose = v.looseObject({
	name: v.string().toTrimmed(),
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

Descriptors of unknown properties are preserved. Declared transformed properties are materialized as ordinary writable data properties.

## Optional fields

Wrap a schema in a one-element tuple:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.number()],
})
```

The input property may be absent. The declared output property is `undefined` when absent.

## Safe `__proto__` fields

A declared `__proto__` key is written as an own enumerable data property. Valchecker does not invoke the legacy prototype setter.

## `array(elementSchema, options?)`

Validates elements in index order and returns their transformed outputs. By default, the first failing element stops later element validation. Set `collectAllIssues: true` to traverse the remaining indexes.

**Issues:**

- `array:expected_array`
- element issues with numeric indices prepended to paths

```ts
const tags = v.array(v.string().toLowercase())
	.isLengthAtLeast(1)
	.isLengthAtMost(5)

await tags.execute(['JS', 'TS', 'NODE'])
// { value: ['js', 'ts', 'node'] }
```

Common array steps include `isEmpty`, `isNotEmpty`, `isLengthAtLeast`, `isLengthAtMost`, `toFiltered`, `toSorted`, `toSliced`, and `toLength`.

## `set(itemSchema, options?)`

Validates Set items in insertion order and returns their transformed outputs in a new Set. The input Set is not mutated.

**Issues:**

- `set:expected_set`
- `set:duplicate_transformed_item`
- item-schema issues with `[index]` prepended to their paths

```ts
const tags = v.set(
	v.string().toTrimmed().toLowercase(),
)

tags.execute(new Set([' TS ', 'Vue']))
// { value: new Set(['ts', 'vue']) }
```

Items are snapshotted at execution start. Fully synchronous child schemas keep the Set schema synchronous; after a reached thenable, remaining items continue sequentially in insertion order. By default, the first recoverable item or transformed-item collision stops traversal. `collectAllIssues: true` preserves complete recoverable issue collection, while an internal child issue always stops later items.

If two source items transform to the same value under the native Set SameValueZero comparison, `set:duplicate_transformed_item` is returned instead of silently reducing Set cardinality.

## `map({ key, value, message?, collectAllIssues? })`

Validates Map keys and values in insertion order and returns a new Map containing their transformed outputs. The key schema, value schema, enclosing message, and issue-collection policy are supplied through one configuration object.

**Issues:**

- `map:expected_map`
- `map:duplicate_transformed_key`
- key-schema issues with `[index, 'key']` prepended to their paths
- value-schema issues with `[index, 'value']` prepended to their paths

```ts
const scores = v.map({
	key: v.string().toTrimmed(),
	value: v.number().isFinite(),
})

scores.execute(new Map([
	[' Alice ', 100],
	[' Bob ', 90],
]))
// { value: new Map([['Alice', 100], ['Bob', 90]]) }
```

For each entry, the key schema executes before the value schema. In the default mode, a key failure skips that entry's value and stops later entries; a value failure also stops later entries. With `collectAllIssues: true`, a recoverable key failure does not hide a value failure from the same entry, and later entries are still checked. An internal key issue stops before the current value schema, and any internal child issue stops later entries.

Entries are snapshotted at execution start. Fully synchronous key and value schemas keep the Map schema synchronous; reached thenables continue sequentially. If two successful source keys transform to the same value under the native Map SameValueZero comparison, `map:duplicate_transformed_key` is returned instead of applying last-write-wins data loss.

The enclosing `message` on `map()` and the options message on `set()` participate in normal structure message resolution for both owned and nested child issues after their collection paths are prepended.

### Collection size and membership

Map and Set outputs expose `isEmpty()`, `isNotEmpty()`, `isSizeAtLeast()`, `isSizeAtMost()`, `isSizeExactly()`, and `toSize()`. Size-validation failures snapshot the single observed `size` value. Existing string and array emptiness failures retain their `length` payloads.

Set membership uses `isIncluding(item)`. Map membership is explicit about the searched domain through `isIncludingKey(key)` and `isIncludingValue(value)`. All three membership forms use SameValueZero equality, so `NaN` matches `NaN` and `0` matches `-0`.

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

## `union(branches)`

Evaluates branches in declaration order and returns the first successful branch's transformed output.

```ts
const identifier = v.union([
	v.string().toTrimmed().transform(value => value.length),
	v.number().isFinite().isInteger().isAtLeast(0),
])

identifier.execute(' abc ')
// { value: 3 }
```

If every branch fails, the result contains collected branch issues. Branch order can affect output and performance. `collectAllIssues` does not apply to `union()`; its first-success and all-branches-failed diagnostics remain unchanged.

### Registration-aware shorthand

Initial-schema steps can extend the values accepted directly by `union()` when they are registered in the same Valchecker instance:

| Registered step | Enabled shorthand |
| --- | --- |
| `literal` | `string`, `number`, `bigint`, `boolean`, and `symbol` literal values |
| `null_` | `null` |
| `undefined_` | `undefined` |

```ts
const v = createValchecker({
	steps: [union, literal, null_, undefined_, number],
})

const value = v.union([
	'auto',
	0,
	null,
	undefined,
	v.number().isGreaterThan(0),
])
```

The shorthand form is normalized during schema construction through the registered provider step. For example, `'auto'`, `null`, and `undefined` are equivalent to `v.literal('auto')`, `v.null()`, and `v.undefined()` respectively. They retain the provider's output, issue code, payload, message resolution, and equality semantics; `union()` does not implement a second primitive validator.

Shorthand availability follows the steps registered on that specific instance. Importing a provider without registering it does not enable its shorthand. Registration order does not matter.

Use an explicit provider schema when a branch needs provider-specific options such as a custom message:

```ts
const value = v.union([
	v.literal('auto', { message: 'Expected automatic mode.' }),
	v.null({ message: 'Expected null.' }),
])
```

### Discriminated unions

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

Literal fields and ordered object branches provide discriminated-union behavior without a separate primitive.

## `variant(options)`

Reads one own discriminator property, performs direct property-key lookup, and executes only the selected branch.

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

**Issues:**

- `variant:expected_object`
- `variant:invalid_discriminator`
- issues from the selected branch

Inputs must be non-null, non-array objects. The discriminator must be an own property whose value is a configured string, number, or symbol property key. Number and string values follow JavaScript property-key canonicalization, so `1` and `'1'` select the same object-key branch.

Variant maps are non-empty schema-time snapshots. Child issue paths remain unchanged and receive `{ type: 'variant', discriminator, discriminatorValue }` context. A variant-level `message` is an enclosing structure scope; an originating child-step message retains priority.

If every branch is synchronous, the schema is synchronous. Otherwise selection remains maybe-async because invalid discriminators can still fail synchronously. Unselected branches never execute.

## `intersection(schemas, options?)`

Executes every branch and composes compatible outputs. By default, branches execute in declaration order and the first failing branch stops later branch evaluation. With `collectAllIssues: true`, recoverable branch failures are collected; after the first asynchronous branch is reached, remaining branches start together.

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

Only plain objects are recursively composed. Enumerable string and symbol keys, compatible cycles, and shared-reference topology are supported.

Equal primitives and the same non-plain reference are preserved. Distinct `Date`, `Map`, class, or other non-plain instances conflict.

**Issue:** `intersection:conflicting_outputs`

Output merging runs only when all branches succeed. Merge conflicts are singular structural failures because no later branch validation remains to collect.

## `instance(constructor, message?)`

Validates with `instanceof`.

**Issue:** `instance:expected_instance`

```ts
const dateSchema = v.instance(Date)

dateSchema.execute(new Date()) // success
dateSchema.execute('2026-01-01') // failure
```

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
