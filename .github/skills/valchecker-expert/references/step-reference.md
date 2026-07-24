# Step Reference

This reference groups the built-in public API by pipeline role.

## Initial primitive schemas

| Step | Successful runtime domain | Output |
| --- | --- | --- |
| `string()` | `typeof value === 'string'` | `string` |
| `number()` | `typeof value === 'number'`, including `NaN` and infinity | `number` |
| `boolean()` | `typeof value === 'boolean'` | `boolean` |
| `bigint()` | `typeof value === 'bigint'` | `bigint` |
| `symbol()` | `typeof value === 'symbol'` | `symbol` |
| `literal(value)` | exact literal match | literal type |
| `null_()` | `null` | `null` |
| `undefined_()` | `undefined` | `undefined` |
| `unknown()` | any input | `unknown` |
| `any()` | any input | `any` |
| `never()` | never succeeds | `never` |
| `json()` | JSON-compatible runtime value | JSON value |

`number()` identifies the TypeScript primitive; add `isFinite()` for finite-number policy.

## Loose primitive schemas

Loose primitives accept the primitive or its TypeScript template-literal string representation, then normalize output:

| Step | Input model | Output |
| --- | --- | --- |
| `looseNumber()` | `number | `${number}`` | `number` |
| `looseBoolean()` | `boolean | `${boolean}`` | `boolean` |
| `looseBigint()` | `bigint | `${bigint}`` | `bigint` |

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

They reject representations outside the corresponding TypeScript contract and do not use unrestricted JavaScript coercion.

## Template-literal schema

`templateLiteral(parts)` validates a string against an assembled TypeScript template-literal type and infers that exact output type, with cross-product union expansion:

| Step | Input model | Output |
| --- | --- | --- |
| `templateLiteral(parts)` | matching template-literal string | assembled template-literal type |

```ts
v.templateLiteral(['ID-', v.number()]).execute('ID-42') // { value: 'ID-42' }, output `ID-${number}`
v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])]) // output `${number}px` | `${number}em` | `${number}rem`
```

Parts are interpolatable literals (`string | number | bigint | boolean | null | undefined`) or bare initial schemas whose output is interpolatable: `string()`, `number()`, `bigint()`, `boolean()`, `literal()`, `null()`, `undefined()`, `union()`, or a nested `templateLiteral()`. Matching mirrors the TypeScript checker's placeholder split (leftmost, one-character adjacent-placeholder capture, no backtracking, all-string reduction), NOT a composed regex; runtime fixtures and compile-time output assertions stay synchronized. Participating schemas advertise a part descriptor through the construction-time `utils.setMetadata` channel (`~core.metadata`); a refined or chained schema part drops that descriptor and is rejected at construction. Issue code `templateLiteral:expected_template_literal` (payload `{ value, template }`) covers non-string input and non-matching strings; construction throws a `TypeError` for unsupported parts or a cross-product exceeding 10000 members.

## Structural initial schemas

### `object(shape)`

Validates declared own fields and omits unknown output properties.

### `strictObject(shape)`

Validates declared own fields and rejects unknown enumerable own string and symbol keys.

### `looseObject(shape)`

Validates declared own fields and preserves unknown own properties.

### `array(elementSchema)`

Validates and transforms each array element in index order.

### `union(schemas)`

Returns the first successful branch's transformed output.

### `intersection(schemas)`

Executes every branch and composes compatible outputs.

### `instance(constructor)`

Checks `instanceof constructor`.

### `file()` and `blob()`

Check that the value is a `File` or `Blob`, preserving it and inferring the matching output type. The global constructors are feature-detected, so absent globals fail with `file:expected_file` / `blob:expected_blob` instead of throwing. `File` is also a `Blob`.

A one-element tuple marks an object field optional:

```ts
v.object({
	required: v.string(),
	optional: [v.number()],
})
```

## Built-in validations

Built-in validations use `isXxx` names and preserve successful values.

### Number validations

| Step | Condition |
| --- | --- |
| `isFinite()` | `Number.isFinite(value)` |
| `isNaN()` | `Number.isNaN(value)` |
| `isInteger()` | `Number.isInteger(value)` |
| `isAtLeast(minimum)` | `value >= minimum`, number or bigint |
| `isAtMost(maximum)` | `value <= maximum`, number or bigint |

```ts
const port = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)
```

A constraint enforces only its named condition. `isAtLeast(0)` accepts positive infinity.

### Length validations

| Step | Condition |
| --- | --- |
| `isEmpty()` | `value.length === 0` |
| `isNotEmpty()` | `value.length > 0` |
| `isLengthAtLeast(minimum)` | `value.length >= minimum` |
| `isLengthAtMost(maximum)` | `value.length <= maximum` |

```ts
const username = v.string()
	.isNotEmpty()
	.isLengthAtLeast(3)
	.isLengthAtMost(32)
```

### String validations

| Step | Condition |
| --- | --- |
| `isStartingWith(prefix)` | `value.startsWith(prefix)` |
| `isEndingWith(suffix)` | `value.endsWith(suffix)` |

### MIME validation

| Step | Condition |
| --- | --- |
| `isMimeType(types)` | `value.type` matches one type or a list, case-insensitive, `image/*` wildcards |

Applies to any output with a `type` string, including `File` and `Blob`. Owns `isMimeType:unexpected_mime_type` with payload `{ value, expected, actual }`.

### `check(predicate, message?)`

Generic validation or type-guard escape hatch. It intentionally retains `check()` because the callback defines the condition.

```ts
v.string().check(value => value.includes('@'), { message: 'Must contain @' })
```

## Concrete transformations

Concrete transformations use `toXxx` names and change the successful output.

### String transformations

- `toTrimmed()`
- `toTrimmedStart()`
- `toTrimmedEnd()`
- `toLowercase()`
- `toUppercase()`
- `toSplit(separator, limit?)`

```ts
v.string().toTrimmed().toSplit(',')
```

### Collection and length transformations

- `toFiltered(predicate)`
- `toSorted(compare?)`
- `toSliced(start, end?)`
- `toLength()`

### General transformations

- `toString()`
- `toJSONValue<T = unknown>(message?)`
- `toJSONString(message?)`

```ts
const config = v.string()
	.toJSONValue()
	.use(v.object({ port: v.number().isFinite() }))
```

### `transform(fn)`

Generic arbitrary-output escape hatch.

```ts
v.string().transform(value => ({ raw: value }))
```

## Flow control and type utilities

### `fallback(getValue)`

Recovers from an earlier pipeline failure with a replacement value.

### `use(schema)`

Delegates the current value to another Valchecker schema and preserves transformed output and issues.

### `generic(factory)`

Creates lazy or recursive schema references.

### `as<T>()`

Changes compile-time output only; performs no runtime validation.

### `toAsync()`

Forces every execution of the complete schema to return a native promise.

## Results

```ts
type ExecutionResult<T, Issue>
	= | { value: T }
		| { issues: Issue[] }
```

Each issue includes:

```ts
interface ExecutionIssue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

Use `v.isSuccess()` and `v.isFailure()` to narrow results.

## Selective registration

```ts
import {
	createValchecker,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({ steps: [number, isFinite] })
```

The default exported `v` includes every built-in step.