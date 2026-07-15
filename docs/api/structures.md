# Structures

Structural validators compose nested schemas and prepend property keys or array indexes to child issue paths without mutating the child issue object.

The normative edge-case behavior is defined in the [Valchecker 1.0 Contract](/guide/v1-contract#object-schemas).

## `object(shape, message?)`

Validates declared fields from own properties. Unknown input properties do not cause failure, but they are omitted from the output.

**Issues**:

- `object:expected_object` — the input is not a non-null, non-array object
- issues produced by declared field schemas

```ts
const user = v.object({
	id: v.string(),
	name: v.string().toTrimmed(),
	age: [v.number().min(0)],
})

await user.execute({
	id: '123',
	name: '  Alice  ',
	extra: 'ignored',
})
// { value: { id: '123', name: 'Alice', age: undefined } }
```

A declared inherited value does not count as an input property:

```ts
const input = Object.create({ id: 'inherited' })
await v.object({ id: v.string() }).execute(input)
// Failure at path ['id']
```

## `strictObject(shape, message?)`

Validates declared own fields and rejects unknown enumerable own keys, including symbols.

**Issues**:

- `strictObject:expected_object` — the input is not a non-null, non-array object
- `strictObject:unexpected_keys` — unknown keys were found; payload `keys` is `PropertyKey[]`
- issues produced by declared field schemas

```ts
const strict = v.strictObject({
	id: v.string(),
})

await strict.execute({ id: '123', extra: true })
// { issues: [{ code: 'strictObject:unexpected_keys', ... }] }
```

Unknown-key detection happens before declared field validation.

## `looseObject(shape, message?)`

Validates declared own fields and preserves unknown own properties in the output. It is not an alias for `object()`.

**Issues**:

- `looseObject:expected_object` — the input is not a non-null, non-array object
- issues produced by declared field schemas

```ts
const loose = v.looseObject({
	name: v.string().toTrimmed(),
})

await loose.execute({
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

Descriptors of unknown properties are preserved. Declared validated properties are materialized as normal writable data properties so an input getter or read-only descriptor cannot retain a stale value.

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

When `__proto__` is declared in the shape, the validated output receives an own enumerable data property. Valchecker does not invoke the legacy prototype setter.

## `array(elementSchema, message?)`

Validates each element in index order and returns an array of transformed element outputs.

**Issues**:

- `array:expected_array` — the input is not an array
- element issues with the numeric index prepended to their path

```ts
const tags = v.array(v.string().toLowercase())
	.min(1)
	.max(5)

await tags.execute(['JS', 'TS', 'NODE'])
// { value: ['js', 'ts', 'node'] }

await tags.execute(['valid', 123])
// issues[0].path === [1]
```

Common array-compatible steps include `min`, `max`, `toFiltered`, `toSorted`, `toSliced`, and `toLength`.

## `union(schemas)`

Evaluates branches in declaration order and returns the first successful branch's transformed output.

```ts
const identifier = v.union([
	v.string().toTrimmed().transform(value => value.length),
	v.number().integer().min(0),
])

await identifier.execute(' abc ')
// { value: 3 }
```

If every branch fails, the failure contains collected branch issues. Branch order can affect the selected output and performance.

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

Valchecker does not require a separate discriminated-union primitive; ordered object branches and literal fields provide the behavior.

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

Only plain objects are recursively composed. The merge supports enumerable string and symbol keys, compatible cycles, and shared-reference topology.

Equal primitive values and the same non-plain reference are preserved. Distinct `Date`, `Map`, class, or other non-plain instances conflict rather than being spread into `{}`.

**Issue**:

- `intersection:conflicting_outputs` — branch outputs cannot be composed; the payload contains the original outputs

After the first asynchronous branch is encountered, remaining branches start together. A synchronous failure encountered before asynchronous work remains fail-fast.

See [Intersection semantics](/guide/v1-contract#intersection-semantics) for the complete graph merge contract.

## `instance(constructor, message?)`

Validates with `instanceof` against the provided constructor.

**Issue**:

- `instance:expected_instance`

```ts
const dateSchema = v.instance(Date)

await dateSchema.execute(new Date())
// { value: Date }

await dateSchema.execute('2026-01-01')
// { issues: [...] }
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

const result = await schema.execute({
	users: [
		{ profile: { name: 'Alice' } },
		{ profile: { name: 123 } },
	],
})

// On failure:
// result.issues[0].path === ['users', 1, 'profile', 'name']
```

Symbols remain symbol path segments. Frozen or reused child issue objects are supported because path prepending clones instead of mutating.
