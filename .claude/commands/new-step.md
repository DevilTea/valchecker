---
description: Add a built-in step plugin across every surface it must touch
argument-hint: <stepName> <one-line semantics>
---

Add the built-in step described by `$ARGUMENTS`.

Read [the dev skill](../skills/valchecker-dev/SKILL.md) plus its
[step unit](../skills/valchecker-dev/references/step-unit.md), architecture, conventions, and
testing references, and an existing step of the same family as the closest precedent before
writing anything.

[The step unit](../skills/valchecker-dev/references/step-unit.md) is the authority on what the
directory holds and how `<name>.ts` is laid out. In short: the required files are `<name>.ts`,
`<name>.test.ts`, `<name>.bench.ts`, `<name>.doc.md`, and a one-line `index.ts`; the only auxiliary test is
`<name>.types.test.ts`; a helper module is kebab-case after the concept it owns; and `<name>.ts` runs
imports → contract types → `type Meta` → `interface PluginDef` → module-private values →
`/* @__NO_SIDE_EFFECTS__ */` and the `implStepPlugin` export as the last statement. Do not split the
runtime suite across files, and do not prefix `Meta`, `PluginDef`, or `Internal`.

The step is not done until all of these are true:

- the directory conforms to the step unit, and `pnpm steps:complete` says so;
- `Meta`, `PluginDef` with canonical JSDoc, and `implStepPlugin()` are all present, with
  `/* @__NO_SIDE_EFFECTS__ */` on the plugin construction;
- it is exported from the local `index.ts` and from `packages/internal/src/steps/index.ts`;
- `api-surface.json` is regenerated with `pnpm api:surface:update`;
- it has a `<name>.doc.md` declaring its `category` and `section`, and `pnpm docs:api:update` has
  regenerated `docs/api/*` and the sidebar from it — never hand-edit a generated page;
- every issue it owns is listed in that entry and asserted by a test in its own directory;
- a cross-library scenario compares it against a competitor, or `scripts/check-benchmark-coverage.ts`
  allowlists it with a reason;
- the default instance test and any affected tree-shaking scenario cover it;
- `CHANGELOG.md` has a real entry under the unreleased section;
- the naming, issue-code, and trailing-options rules in `AGENTS.md` hold;
- `pnpm verify` passes.

`pnpm steps:complete` reports everything still missing from that list at once, so run it while
working rather than waiting for the full gate. It decides the mechanical half: that the directory
holds only the files the step unit names and that `<name>.ts` runs in the canonical order, that the
test file
registers an `it` or `test`, that the bench file calls `bench`, that the export reaches
`api-surface.json`, that `<name>.doc.md` writes the step's name in call form in a code span and
carries a description and a `ts` example, and that each owned issue code appears in a code span of
that entry and in a string in one of the directory's tests. `pnpm docs:api` decides the rest of the
documentation mechanically: that the entry can be placed on a page at all, and that the committed
`docs/api/*` matches what the entries compose. Neither can decide whether the test asserts
anything, whether the string reaches an assertion, or whether the entry describes the step rather
than merely naming it. Those are on you.

If the requested name or semantics conflict with the naming rules — for example a validation
that hides conversion policy — say so in one sentence and propose the conforming name before
implementing.
