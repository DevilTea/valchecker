---
description: Add a built-in step plugin across every surface it must touch
argument-hint: <stepName> <one-line semantics>
---

Add the built-in step described by `$ARGUMENTS`.

Read [the dev skill](../skills/valchecker-dev/SKILL.md) plus its architecture, conventions, and
testing references, and an existing step of the same family as the closest precedent before
writing anything.

The step is not done until all of these are true:

- `packages/internal/src/steps/<name>/` holds `<name>.ts`, `<name>.test.ts`, `<name>.bench.ts`,
  and `index.ts`;
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

`pnpm steps:complete` checks most of that list on its own and reports everything still missing at
once, so run it while working rather than waiting for the full gate.

If the requested name or semantics conflict with the naming rules — for example a validation
that hides conversion policy — say so in one sentence and propose the conforming name before
implementing.
