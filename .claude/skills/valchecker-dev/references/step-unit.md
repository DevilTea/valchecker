# The step unit

A built-in step is one directory under `packages/internal/src/steps/`, named after the step's public
name (`Meta.Name`). This is the whole standard for what that directory holds and how its
implementation file is laid out. `pnpm steps:complete` reports every deviation for every step at
once; the rules live in `scripts/step-completeness.ts`.

## File set

`packages/internal/src/steps/<name>/` holds exactly:

| File | | Purpose |
| --- | --- | --- |
| `<name>.ts` | required | `Meta`, `PluginDef`, and the exported plugin |
| `<name>.test.ts` | required | the runtime suite |
| `<name>.bench.ts` | required | the focused benchmark |
| `index.ts` | required | exactly `export * from './<name>'` |
| `<name>.types.test.ts` | optional | the type-level suite. Must call `expectTypeOf` or `assertType`: its assertions are decided by `pnpm typecheck`, not by the vitest run that executes them |
| `<helper>.ts` | optional | a helper module, `kebab-case`, named after the concept it owns — `base64url.ts`, `iso-calendar-date.ts`, `template-literal-part.ts`. `<name>.ts` must reach it, directly or through another helper. Other steps import it by direct relative path, and `index.ts` does not re-export it |
| `<helper>.test.ts`, `<helper>.types.test.ts` | optional | that helper's own suites |

Nothing else. A runtime suite that grows large stays one file with more `describe` blocks — not
`<name>.async.test.ts`, `collectAllIssues.test.ts`, or `lazy-output.test.ts`. Each of those names
held one slice of a single step's contract while reading like a separate subject, and a reader
listing the directory could not tell which of them carried the step's own tests.

`<name>.types.test.ts` is the one auxiliary test the standard names, because its assertions are
decided by a different tool: `expectTypeOf` is a runtime no-op, so the file passes vitest whatever it
claims and `pnpm typecheck` is what fails on it. That is also why the name has to be earned — a
`<name>.types.test.ts` full of runtime `expect` calls is the exception being used as a way around the
fold, so the gate requires a type-level assertion in it. A runtime split has no such reason.

The reachability requirement on a helper exists for the same reason. Without it the file-set rule
cost one line to defeat: a `lazy-output.ts` containing `export {}` re-admits the 231-line
`lazy-output.test.ts` beside it. Reached is not *used*, though — adding `import './lazy-output'` to
`<name>.ts` satisfies the rule, at the price of an import a reviewer reads in the implementation.

Step tests use inline snapshots. There is no place in a step unit for a `__snapshots__` directory.

## The steps root

`packages/internal/src/steps/` itself holds three things and nothing else:

- `index.ts`, the barrel that re-exports every step directory and is the independent list
  `scripts/step-inventory.ts` checks discovery against;
- modules shared across step directories, `kebab-case` like a helper inside one —
  `callback-error-sentinel.ts`;
- **cross-step tests**: `<family>.<aspect>.test.ts`, both parts `kebab-case`, `<aspect>` being
  `types` for a type-level suite — `structural.sync-fast-path.test.ts`,
  `callback-operation.contract.test.ts`, `failure-payload.types.test.ts`.

A cross-step test is one asserting a contract that spans a family of steps and belongs to no single
one of them; it builds an instance from several steps and asserts what they must agree on. That is
why the two-part name is required, and why `<family>` must not be the name of a step: these files sit
outside the per-step scan, so without both halves of the rule a test of one step could sit among them
looking like a family contract. Checking only the shape was not enough — every all-lowercase step
directory name is also a valid `kebab-case` family, so `map.async.test.ts` moved up one directory
satisfied it. Conversely, a family contract does not belong inside whichever member happened to be
open when it was written.

## In-file order of `<name>.ts`

1. `import type` declarations, then value `import` declarations.
2. The type contract — the local type declarations `Meta` or `PluginDef` refers to. Conventionally
   one `declare namespace Internal` holding the `ExecutionIssue` types the step owns.
3. `type Meta = DefineStepMethodMeta<{ … }>`, or `type Meta<T> = …` when the step is generic over its
   operand.
4. `interface PluginDef extends TStepPluginDef`, carrying the
   [canonical JSDoc](./conventions.md#canonical-jsdoc).
5. Implementation support — module-private constants, functions, and types reached only from the
   runtime.
6. `/* @__NO_SIDE_EFFECTS__ */`, then `export const <identifier> = implStepPlugin<PluginDef>(…)`: the
   last statement in the file, and its only export.

The names are fixed. A step generic over `number | bigint` writes `type Meta<T>` and
`interface PluginDef`, not `AtLeastMeta<T>` and `AtLeastPluginDef`; its issue namespace is
`Internal`, not `AtLeastInternal`. Nothing is gained by a prefix on a declaration no other module
can see, and a reader comparing two steps pays for it.

The contract precedes the machinery that satisfies it, so opening a step file shows what it does
before how — `isEmoji` put 120 lines of regular-expression construction above its `Meta`. Values sit
below `PluginDef` and above the one statement that reads them, so the file never forward-references.

Section 2 admits **only erased syntax**: `type`, `interface`, and `declare namespace`. Anything the
compiler emits belongs to section 5, including a `namespace` without `declare` (it emits an IIFE), a
bare expression statement, a top-level `await`, and `import x = require(…)`. The rule is written as
that allow-list rather than as a list of value kinds because an enumeration of `const`/`function`/
`class`/`enum` had all four of those ways past it.

### What the gate decides, and what it leaves to review

Section 1 is the eslint import rules. From the rest, `scripts/step-completeness.ts` decides that
`Meta` and `PluginDef` exist under those names, that `Meta` precedes `PluginDef`, that nothing but
erased syntax precedes `PluginDef`, that a local namespace is named `Internal`, that `implStepPlugin`
is constructed exactly once as the file's last statement, and that the plugin is the file's only
export. It decides the file set, both naming patterns, and the steps root.

Three things it cannot decide, and their limits are the honest ones:

- **Which section a *type* belongs to.** A type in section 2 and one in section 5 are the same
  syntax. That split is review guidance — a type `Meta` or `PluginDef` refers to goes above `Meta`;
  one only the runtime reaches goes below `PluginDef`, beside the functions that use it, which is why
  `intersection` keeps `interface FlatProperties` next to `readFlatProperties` rather than 400 lines
  away.
- **Whether a helper is used or merely reached.** See above.
- **Whether a `<name>.types.test.ts`'s type assertions say anything true.** It checks that one is
  present, not that it is meaningful — the same limit the runtime test rule has.

Do not reshape a step's implementation to satisfy the order. If a step genuinely cannot follow it,
the order is wrong and this file is what changes.
