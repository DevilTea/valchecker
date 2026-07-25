<!--
New here? CONTRIBUTING.md has everything you need. The short version: `pnpm verify` is the gate,
never hand-edit api-surface.json, and public behaviour changes need a CHANGELOG.md entry.
-->

## What contract changed

<!-- The observable behaviour before and after. If nothing observable changed, say so and why the
change is worth making. Link the issue if there is one. -->

## What was verified

<!-- The commands you actually ran and what they said. `pnpm verify` covers the standard gate; name
anything extra (pnpm typeperf, focused benchmarks) and paste the decisive numbers. -->

## Public surface

- [ ] No change to exported names, signatures, issue codes, or payloads
- [ ] Public surface changed — `pnpm api:surface:update` was run and the result is committed
- [ ] Breaking — `CHANGELOG.md` and `MIGRATION.md` are updated
