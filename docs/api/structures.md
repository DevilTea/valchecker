# Structures

Structural validators compose nested schemas and prepend property keys or array indexes to child issue paths without mutating child issues.

The normative edge-case behavior is defined in the [Valchecker 1.0 Contract](/guide/v1-contract#object-schemas).

## `object(shape, message?)`

Validates declared own fields. Unknown input properties do not fail validation, but are omitted from output.

**Issues:**

- `object:expected_object`
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

## `strictObject(shape, message?)`

Validates declared own fields and rejects unknown enumerable own string and symbol keys.

**Issues:**

- `strictObject:expected_object`
- `strictObject:unexpected_keys`
- issues from declared field schemas

Unknown-key detection happens before declared field validation.

## `looseObject(shape, message?)`

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

## `array(elementSchema, message?)`

Validates elements in index order and returns their transformed outputs.

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

Items are snapshotted at execution start. Fully synchronous child schemas keep the Set schema synchronous; after a reached thenable, remaining items continue sequentially in insertion order. Recoverable child issues are collected, while an internal child issue stops later items.

If two source items transform to the same value under the native Set SameValueZero comparison, `set:duplicate_transformed_item` is returned instead of silently reducing Set cardinality.

## `map({ key, value, message? })`

Validates Map keys and values in insertion order and returns a new Map containing their transformed outputs. The key schema, value schema, and optional enclosing message are supplied through one configuration object.

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

For each entry, the key schema executes before the value schema. A recoverable key failure does not hide a value failure from the same entry, so both can be reported. An internal key issue stops before the current value schema; any internal child issue stops later entries.

Entries are snapshotted at execution start. Fully synchronous key and value schemas keep the Map schema synchronous; reached thenables continue sequentially. If two successful source keys transform to the same value under the native Map SameValueZero comparison, `map:duplicate_transformed_key` is returned instead of applying last-write-wins data loss.

The enclosing `message` on `map()` and the options message on `set()` participate in normal structure message resolution for both owned and nested child issues after their collection paths are prepended.

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

If every branch fails, the result contains collected branch issues. Branch order can affect output and performance.

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

## `intersection(schemas)`

Executes every branch and composes compatible outputs.

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

After the first asynchronous branch is reached, remaining branches start together. A synchronous failure before asynchronous work remains fail-fast.

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
