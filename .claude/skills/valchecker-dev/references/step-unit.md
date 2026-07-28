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
| `<name>.types.test.ts` | optional | the type-level suite: `expectTypeOf` assertions, decided by `pnpm typecheck` rather than by the vitest run that executes them |
| `<helper>.ts` | optional | a helper module, `kebab-case`, named after the concept it owns — `base64url.ts`, `iso-calendar-date.ts`, `template-literal-part.ts`. Other steps import it by direct relative path, and `index.ts` does not re-export it |
| `<helper>.test.ts` | optional | that helper's own suite |

Nothing else. A runtime suite that grows large stays one file with more `describe` blocks — not
`<name>.async.test.ts`, `collectAllIssues.test.ts`, or `lazy-output.test.ts`. Each of those names
held one slice of a single step's contract while reading like a separate subject, and a reader
listing the directory could not tell which of them carried the step's own tests.

`<name>.types.test.ts` is the one auxiliary test the standard names, because its assertions are
decided by a different tool: `expectTypeOf` is a runtime no-op, so the file passes vitest whatever it
claims and `pnpm typecheck` is what fails on it. A runtime split has no such reason.

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
why the two-part name is required: these files sit outside the per-step scan, so without it a test of
one step could sit among them looking like a family contract. Conversely, a family contract does not
belong inside whichever member happened to be open when it was written.

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

### What the gate decides, and what it leaves to review

Section 1 is the eslint import rules. From the rest, `scripts/step-completeness.ts` decides that
`Meta` and `PluginDef` exist under those names, that `Meta` precedes `PluginDef`, that no value
declaration precedes `PluginDef`, that a `declare namespace` is named `Internal`, and that the
exported `implStepPlugin` call is the file's last statement. It decides the file set and both naming
patterns outright, and the steps root as well.

It cannot decide which section a *type* belongs to: a type in section 2 and one in section 5 are the
same syntax. That split is review guidance — a type `Meta` or `PluginDef` refers to goes above
`Meta`; one only the runtime reaches goes below `PluginDef`, beside the functions that use it, which
is why `intersection` keeps `interface FlatProperties` next to `readFlatProperties` rather than 400
lines away.

Do not reshape a step's implementation to satisfy the order. If a step genuinely cannot follow it,
the order is wrong and this file is what changes.
