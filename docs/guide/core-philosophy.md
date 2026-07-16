# Core Philosophy

Valchecker is built from immutable step plugins executed in a deterministic pipeline. Runtime behavior, TypeScript inference, editor discoverability, and tree-shaking are treated as one design problem.

## Pipeline model

```text
Input → initial step → validation → transformation → validation → Output
                         ↓               ↓
                       issues          issues
```

A reached step can:

- succeed and forward a value,
- succeed with a transformed value,
- fail with structured issues,
- recover from an earlier failure,
- delegate to another schema.

## Names expose behavior

Built-in names deliberately identify a step's role:

| Role | Convention | Examples |
| --- | --- | --- |
| Initial schema | noun or noun phrase | `string()`, `number()`, `object()`, `looseBoolean()` |
| Built-in validation | `isXxx()` | `isFinite()`, `isInteger()`, `isLengthAtLeast()` |
| Concrete transformation | `toXxx()` | `toTrimmed()`, `toSplit()`, `toJSONValue()` |
| Generic operation | direct verb | `check()`, `transform()`, `fallback()`, `use()` |

This convention is not cosmetic. After a schema narrows to a particular output type, editor autocomplete can group the meaningful next operations under `is` and `to`.

```ts
const schema = v.string()
	.toTrimmed()
	.isNotEmpty()
	.isLengthAtMost(100)
	.toLowercase()
```

`check()` and `transform()` remain explicit generic escape hatches because names such as `isValid()` or `toTransformed()` would conceal their callback-defined behavior.

## Initial schemas identify runtime domains

Primitive initial steps align with TypeScript primitive identities:

```ts
v.string() // typeof value === 'string'
v.number() // typeof value === 'number'
v.boolean() // typeof value === 'boolean'
v.bigint() // typeof value === 'bigint'
```

The important consequence is that `number()` accepts `NaN`, `Infinity`, and `-Infinity`. They are JavaScript numbers and belong to TypeScript's `number` type.

Finite-number policy is a validation constraint, not hidden type identity:

```ts
v.number().isFinite()
```

Each named validation checks only the condition it states:

```ts
v.number().isAtLeast(0) // Infinity succeeds
v.number().isFinite().isAtLeast(0) // Infinity fails
```

This keeps steps orthogonal and composition predictable.

## Loose primitives normalize typed representations

Loose primitives accept a canonical primitive or its matching TypeScript template-literal string representation, then output the canonical primitive:

```ts
v.looseNumber() // number | `${number}` → number
v.looseBoolean() // boolean | `${boolean}` → boolean
v.looseBigint() // bigint | `${bigint}` → bigint
```

They do not mirror JavaScript constructors or truthiness:

```ts
v.looseBoolean().execute('false') // { value: false }
v.looseBoolean().execute(1) // failure
v.looseNumber().execute('') // failure, not 0
```

## Validation and transformation stay distinct

A validation preserves a successful value:

```ts
v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(0)
```

A transformation changes the output value or representation:

```ts
v.string()
	.toTrimmed()
	.toSplit(',')
	.toLength()
```

The inferred output follows each transformation automatically.

## Immutable schemas

Every chained method returns a new schema:

```ts
const rawName = v.string()
const trimmedName = rawName.toTrimmed()
const requiredName = trimmedName.isNotEmpty()
```

No schema is mutated. Reusing an earlier pipeline is safe and deterministic.

## Structured issues

Validation failures are returned as data:

```ts
type Result<T, Issue>
	= | { value: T }
		| { issues: Issue[] }

interface Issue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

Codes identify the failing contract, while payloads preserve machine-readable context:

```ts
v.number().isAtLeast(10).execute(5)
// issue code: isAtLeast:expected_at_least
// payload: { target: 'number', value: 5, minimum: 10 }
```

Nested schemas prepend paths by creating new issue objects rather than mutating child issues.

## Sync and maybe-async execution

Execution mode is determined by reached work, not merely by schema declaration:

```ts
const schema = v.string().check(async value => value.length > 0)

schema.execute('value') // Promise<ExecutionResult<string>>
schema.execute(42) // synchronous type failure; callback not reached
```

Use `.toAsync()` when an API boundary requires every invocation to return a native promise.

## Structural composition

Structural steps orchestrate nested pipelines:

```ts
const user = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	age: v.looseNumber().isFinite().isInteger(),
	tags: [v.array(v.string())],
})
```

- `object()` validates declared own properties and omits unknown output properties.
- `strictObject()` rejects unknown enumerable own string and symbol keys.
- `looseObject()` preserves unknown own properties.
- `array()` validates and transforms every element.
- `union()` returns the first successful branch's transformed output.
- `intersection()` composes compatible branch outputs.

A one-element tuple marks an object field optional.

## Tree-shakable fluent API

The default `v` instance provides every built-in step:

```ts
import { v } from 'valchecker'
```

A selective instance registers only imported plugins:

```ts
import {
	createValchecker,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({ steps: [number, isFinite] })
```

Both modes expose the same state-aware fluent model. Selective registration gives bundlers explicit control over runtime step inclusion.

## Design principles

1. **Type-aligned** — primitive schemas match TypeScript identities.
2. **Explicit** — runtime policy is expressed through named constraints.
3. **Composable** — a step enforces only its own contract.
4. **Discoverable** — method names and type state guide editor autocomplete.
5. **Immutable** — schemas can be safely reused.
6. **Deterministic** — failures are structured results, not validation exceptions.
7. **Extensible** — custom plugins use the same core protocol.
8. **Tree-shakable** — fluent DX does not require bundling every implementation.

## Production guidance

Define reusable schemas outside hot paths, select only the step plugins needed by bundle-sensitive applications, and log structured issue codes and paths instead of parsing human-readable messages.

## Next steps

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — normative runtime semantics
- **[Custom Steps](/guide/custom-steps)** — plugin-author API
- **[API Reference](/api/overview)** — built-in steps
- **[Examples](/examples/basic-validation)** — applied patterns