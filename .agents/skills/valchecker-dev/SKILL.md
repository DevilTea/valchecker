---
name: valchecker-dev
description: Maintain the Valchecker repository, including architecture, plugins, tests, public API, documentation, benchmarks, CI, and pull-request completion.
---

# Valchecker Development Guide

Use this skill for changes to the Valchecker repository. Use `valchecker-expert` for application code that only consumes Valchecker.

## Start every task

1. Read the root `AGENTS.md` completely.
2. Inspect the affected source, runtime and type tests, exports, package scripts, workflows, benchmarks, API-surface record, and documentation.
3. Load every task-relevant reference below.
4. Treat current executable repository evidence as authoritative when older prose conflicts.
5. Avoid duplicate registries, parallel abstractions, and unsupported package-private imports.

## Verification

The normal full repository checks are:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm api:surface
pnpm publint
pnpm test:package
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm docs:build
```

Run `pnpm typeperf`, focused step benchmarks, cross-library benchmarks, tree-shaking reports, and impact workflows when applicable. Never report a command or workflow as passing without inspecting the result.

## Change discipline

- Preserve state-aware method availability and input/output/issue/operation-mode inference.
- Keep issue code, category, payload, message, path/context behavior, tests, and docs synchronized.
- Preserve `/* @__NO_SIDE_EFFECTS__ */` on plugin construction.
- Let `allSteps` discover plugins through the runtime marker.
- Keep schema instances on the shared-prototype architecture unless benchmarked contract review justifies a replacement.
- Treat internal issues as fatal through structures, union, intersection, and fallback.
- Update `api-surface.json` only for intentional public export changes.
- Treat coverage as a guardrail; tests must protect a contract.

## Pull-request completion

Open as Draft, review the complete diff, run a review-and-fix loop, resolve feedback, then verify CI and all relevant type-performance, bundle, and runtime-impact workflows. Mark Ready only after every applicable gate is complete. Squash merge only when requested and safe.

## References

- [Architecture](./references/architecture.md)
- [Conventions](./references/conventions.md)
- [Testing](./references/testing.md)
- [Benchmarking](./references/benchmarking.md)
- [Runtime boundaries](./references/runtime-boundaries.md)
- [Step implementation utilities](./references/utils-api.md)
- [Implementation examples](./references/examples.md)
- [Pull-request checklist](./references/checklist.md)
- [Documentation site](../../../docs/index.md)
