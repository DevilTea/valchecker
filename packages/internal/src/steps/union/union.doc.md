<!-- step-doc
category: structures
section: composition
summary: the first successful branch's transformed output, with registration-aware shorthand
-->

### `union(branches)`

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
