# Code Style and Conventions

## Code style

- TypeScript strict mode
- single quotes and no semicolons
- tabs for indentation
- functional and immutable patterns
- avoid `any` unless a runtime boundary genuinely requires it
- preserve `/* @__NO_SIDE_EFFECTS__ */` on tree-shakable plugin exports

## Public step naming

### Initial schemas

Use nouns or noun phrases:

```text
string
number
object
strictObject
looseNumber
looseBoolean
looseBigint
```

Primitive initial schemas align with TypeScript primitive identities. Initial schemas may normalize only an explicitly documented representation, as loose primitives do.

### Built-in validations

Use natural `isXxx` boolean propositions:

```text
isEmpty
isNotEmpty
isInteger
isFinite
isNaN
isAtLeast
isAtMost
isLengthAtLeast
isLengthAtMost
isStartingWith
isEndingWith
```

Do not mechanically prepend `is` to an inflected verb. For example, use `isStartingWith`, not `isStartsWith`.

A validation preserves the successful value and enforces only the condition expressed by its name.

### Concrete transformations

Use `toXxx` and describe the resulting state or representation:

```text
toTrimmed
toLowercase
toSplit
toJSONValue
toJSONString
toSorted
toFiltered
```

### Generic and flow-control operations

Use the most direct semantic verb:

```text
check
transform
fallback
use
generic
as
toAsync
```

`check()` and `transform()` intentionally remain generic escape hatches rather than synthetic `isValid()` or `toTransformed()` methods.

## Step parameters

Message-bearing built-in steps use one consistent parameter contract:

- a single required semantic operand may remain positional;
- every optional configuration field and the step message belong to one trailing options object;
- a step with no required operand accepts only an optional options object;
- a step that already requires a named configuration object includes `message` in that same object;
- direct positional messages are forbidden.

Examples:

```ts
v.number().isAtLeast(0, { message: 'Expected a non-negative number.' })
v.number().isFinite({ message: 'Expected a finite number.' })
v.array(v.string()).toFiltered(predicate, { thisArg, message })
v.array(v.number()).toSorted({ compareFn, message })
```

Built-in step definitions are checked by `pnpm test:quality`. Steps without message support may preserve a native positional signature when it is semantically clearer.

## Step parameters

Message-bearing built-in steps use one consistent parameter contract:

- a single required semantic operand may remain positional;
- every optional configuration field and the step message belong to one trailing options object;
- a step with no required operand accepts only an optional options object;
- a step that already requires a named configuration object includes `message` in that same object;
- direct positional messages are forbidden.

Examples:

```ts
v.number().isAtLeast(0, { message: 'Expected a non-negative number.' })
v.string().isFinite({ message: 'Invalid value.' }) // unavailable because the state is not numeric
v.array(v.string()).toFiltered(predicate, { thisArg, message })
v.array(v.number()).toSorted({ compareFn, message })
```

Built-in step definitions are checked by `pnpm test:quality`; new optional positional parameters or direct `MessageHandler` parameters fail CI. Steps without message support may preserve a native positional signature when it is semantically clearer.

## Issue codes

Format:

```text
<public-step-name>:<snake_case_description>
```

Good examples:

```text
string:expected_string
isFinite:expected_finite
isAtLeast:expected_at_least
isLengthAtLeast:expected_length_at_least
toJSONValue:invalid_json
toJSONString:serialization_failed
check:failed
check:callback_failed
transform:callback_failed
```

The public method name, `Meta.Name`, type-level `SelfIssue`, runtime `createIssue()` code, tests, docs, and migration notes must agree.

Issue payload field names should describe semantics rather than implementation abbreviations:

```ts
{ value, minimum }
{ value, maximum }
{ value, prefix }
{ value, suffix }
```

Callback issues should preserve callback phase or operands, serialization issues should preserve `at` and `error`, and length issues should snapshot `length`. If multiple payload variants share one code, keep a discriminant so message handlers narrow precisely.

## File layout

A normal step module contains:

```text
packages/internal/src/steps/<module>/
├── <module>.ts
├── <module>.test.ts
├── <module>.bench.ts
└── index.ts
```

Historical directory names may differ from the current public method name. Do not move files solely for cosmetic consistency when doing so would add review noise without architectural value.

## Plugin types

Use the established names:

- `Meta` for step metadata,
- `PluginDef` for the plugin definition,
- `SelfIssue` for the step's own issue type,
- `Internal` namespaces when helper types must remain module-local.

## JSDoc

Every public step method documents:

1. behavior and state requirements,
2. a selective-import example,
3. issue codes and failure conditions,
4. output changes for transformations,
5. relevant edge cases such as `NaN`, infinity, or TypeScript-compatible loose strings.

```ts
/**
 * ### Description:
 * Checks that the number is finite.
 *
 * ---
 *
 * ### Example:
 * ```ts
 * const v = createValchecker({ steps: [number, isFinite] })
 * const schema = v.number().isFinite()
 * ```
 *
 * ---
 *
 * ### Issues:
 * - `'isFinite:expected_finite'`: The number is not finite.
 */
```

## Tree-shaking annotation

```ts
/* @__NO_SIDE_EFFECTS__ */
export const isFinite = implStepPlugin<PluginDef>({
	// ...
})
```

The annotation must remain immediately associated with the plugin construction so bundlers can eliminate unused implementations.

## Imports

Prefer type-only imports where applicable and follow the surrounding module's ordering. Tests normally import public APIs through the package or step barrel being exercised rather than reaching into implementation internals.

## Comments

Comment why a non-obvious choice exists, not what a direct expression already states. Performance comments must be supported by a benchmark or profiling result.

## Default messages

Messages should be concise and describe the expected condition:

```text
Expected a number.
Expected a finite number.
Expected a value of at least 10.
Expected a length of at most 20.
```

Do not encode application-specific policy in a primitive identity message.

## Exports

Each step directory re-exports its implementation through `index.ts`, and `packages/internal/src/steps/index.ts` exports the directory.

Intentional public API changes must also update `api-surface.json`. The `allSteps` collection discovers exported plugin objects through the runtime marker; do not maintain a second manual list.