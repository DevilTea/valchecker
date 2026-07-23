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

### Payload key naming

A payload key must be unambiguous to a message handler that reads it without knowing which step produced it. Do not let sibling or cross-family steps reuse the same key for different operands.

- Numeric value bounds stay unqualified: `minimum`, `maximum` (`isAtLeast`, `isAtMost`, and the strict `isGreaterThan` / `isLessThan`).
- Length-based operands are qualified: `minimumLength`, `maximumLength`, `expectedLength`.
- Size-based operands are qualified: `minimumSize`, `maximumSize`, `expectedSize`.
- Exact-match operands use `expected<Thing>` (`expectedLength`, `expectedSize`).
- Membership and search operands use `expected` across every variant. `isIncluding` for `string`, array, and `Set` is unified on `expected` (not `search`).

Payload keys are public contract. Renaming one is a breaking change and must follow [Public API changes](../../AGENTS.md).

### Issue category

`category` is a public field consumers narrow on, so equivalent semantic events must share a category across the whole step family.

- `'operation'`: executing user or native code that throws or rejects. This covers `check:callback_failed`, `transform:callback_failed`, `to*:callback_failed`, `toString:conversion_failed`, `toJSONString:serialization_failed`, and the native-conversion throws `toNumber:conversion_failed` and `toBigint:conversion_failed`.
- `'validation'`: statically invalid input or a parse failure, for example `toJSONValue:invalid_json` (a malformed input string, not thrown user code).
- `'internal'`: core-level faults; recovery steps treat these as fatal.

The two-argument `ExecutionIssue<>` / `SelfIssue` defaults to `'validation'`; pass `'operation'` or `'internal'` explicitly when a code falls in those categories.

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

Every public step's `PluginDef` method carries the three-section template exactly, in this order, separated by `---`:

- `### Description:` — behavior, state requirements, output changes for transformations, and relevant edge cases such as `NaN`, infinity, or TypeScript-compatible loose strings;
- `### Example:` — a selective-import example (`import { createValchecker, ... } from 'valchecker'`);
- `### Issues:` — every issue code the step owns with its failure condition, or `None.` when the step owns no issue.

The three `###` headings are the single canonical format; do not use bare prose, `@example`, or `@issues` tags. `scripts/check-step-jsdoc.ts` (part of `pnpm test:quality`) scans each step's main file (`<dir>/<dir>.ts`), locates its `*PluginDef` interface by name (prefixed names such as `AtLeastPluginDef` are matched), and fails CI if any of the three headings is missing or if the main file declares no `PluginDef` at all. Secondary step files (for example shorthand variants) are outside this scan by design.

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