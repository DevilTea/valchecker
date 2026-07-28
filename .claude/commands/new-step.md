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
`<name>.test.ts`, `<name>.bench.ts`, and a one-line `index.ts`; the only auxiliary test is
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
- `docs/api/overview.md` lists it, and one further `docs/api` page describes it;
- every issue it owns is documented under `docs/api` and asserted by a test in its own directory;
- a cross-library scenario compares it against a competitor, or `scripts/check-benchmark-coverage.ts`
  allowlists it with a reason;
- the default instance test and any affected tree-shaking scenario cover it;
- `CHANGELOG.md` has a real entry under the unreleased section;
- the naming, issue-code, and trailing-options rules in `AGENTS.md` hold;
- `pnpm verify` passes.

`pnpm steps:complete` reports everything still missing from that list at once, so run it while
working rather than waiting for the full gate. It decides the mechanical half: that the test file
registers an `it` or `test`, that the bench file calls `bench`, that the export reaches
`api-surface.json`, that the step's name appears in call form in a code span on the catalog page
and on one further `docs/api` page, and that each owned issue code appears under `docs/api` and in
a string in one of the directory's tests. It cannot decide the other half — whether the test
asserts anything, whether the string reaches an assertion, or whether the page describes the step
rather than merely naming it. Those are on you.

If the requested name or semantics conflict with the naming rules — for example a validation
that hides conversion policy — say so in one sentence and propose the conforming name before
implementing.
