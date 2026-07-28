# AGENTS.md

Repository-wide rules for agents maintaining Valchecker. **Outside contributors should read [`CONTRIBUTING.md`](CONTRIBUTING.md) instead** — it is self-contained and needs nothing from here.

This repository is Claude Code first. The canonical agent configuration lives in [`.claude/`](.claude): [`skills/valchecker-dev/`](.claude/skills/valchecker-dev/SKILL.md) for repository maintenance, [`skills/valchecker-expert/`](.claude/skills/valchecker-expert/SKILL.md) for application code that only consumes Valchecker. `.agents/skills/` holds pointers for other harnesses. This file is the baseline; the skills add depth and must not contradict it.

## Project overview

Valchecker is an ESM-only TypeScript validation library with state-aware fluent steps, transformed-output inference, structured non-empty issue results, Standard Schema V1, and selective tree-shakable plugin registration.

```text
packages/internal/      core implementation and built-in plugins
packages/all-steps/     runtime-marker-discovered allSteps collection
packages/valchecker/    application package and default v instance
docs/                   VitePress documentation
benchmarks/             runtime, impact, and tree-shaking tooling
type-performance/       TypeScript compiler-complexity fixture and budget
```

## How to work here

**Scope.** Deliver what was asked, at the scope intended. Do not add features, refactor, or introduce abstractions beyond what the task requires; a bug fix does not need surrounding cleanup. Do not add error handling or validation for scenarios that cannot happen — but see [runtime boundaries](.claude/skills/valchecker-dev/references/runtime-boundaries.md), because in this repository ordinary public inputs are a real boundary and stay validated. If a request looks mistaken, say so in a sentence and continue with it as asked.

**Act when you have enough information.** Executable current repository evidence outranks older PRs and stale prose. Read the code a change touches before describing or editing it. Do not re-derive facts already established, re-litigate a settled decision, or list options you will not pursue.

**Ground every progress claim.** Before reporting, check each claim against a tool result from this session. If tests fail, say so with the output; if a step was skipped, say that; if something is unverified, label it. Never report a command or workflow as passing without having inspected its result.

**Pause only when the work genuinely requires the user:** a destructive or irreversible action, a real scope change, or input only they can provide. Then ask and end the turn, rather than ending on a promise.

**Never do these unless asked in the current conversation:**

- push to `main`, force-push, create tags, or run the release workflow;
- hand-edit `api-surface.json` — regenerate it with `pnpm api:surface:update`;
- raise a threshold in `type-performance/budget.json` or `scripts/coverage-policy.ts` to make a gate pass;
- delete branches or worktrees, or bypass hooks with `--no-verify`.

**Destructive commands earn their confirmation.** Most operations here are permitted at the cost of a
confirmation prompt, and a prompt showing only a command line is not enough to judge by. So before
requesting one, run the read-only form first and report what would be lost:

- `git clean` — run `git clean -n` and list the files by name;
- `git reset --hard`, `git checkout -- <path>` — these destroy uncommitted work that no reflog can
  recover. Show `git status` and `git stash list` first, and name what disappears;
- `git push` — run `git push --dry-run` when the refspec is not obvious;
- deleting any ref — record the SHA first. If the ref is not reachable from `main` and has no merged
  pull request, `git bundle` it and verify the bundle before deleting.

Prefix-matched permission rules cannot express "any branch except `main`", so they are an
accident guard, not a boundary. Treat the protections that do not depend on string matching — the
`main` ruleset and npm Trusted Publishing — as the real ones, and do not go around them.

**Delegation.** Use a subagent for a genuinely independent, wide investigation across many files. Do not delegate work you can finish in a handful of tool calls, and do not use a subagent to verify your own work.

## Verification

```bash
pnpm install --frozen-lockfile   # only when dependencies or the lockfile changed
pnpm verify                      # build, api:surface, publint, test:package, lint, typecheck, test:coverage, docs:examples, docs:build
```

`pnpm verify` is the complete gate and the single source of truth for what "checked" means; CI runs the same commands. Use focused checks while working, then `pnpm verify` before reporting completion.

Run these separately when the change can affect them: `pnpm typeperf` for the type-complexity budget, focused step benchmarks, cross-library benchmarks, and the bundle-size and performance-impact workflows. See [benchmarking](.claude/skills/valchecker-dev/references/benchmarking.md).

Every CI pipeline must preserve the failing command's exit code; commands piped into `tee` or another process run under `set -o pipefail`. Enforced by `scripts/check-workflow-pipefail.ts`.

## Code and runtime boundaries

TypeScript strict mode; single quotes; no semicolons; tabs. Prefer functional, immutable-by-replacement patterns and existing abstractions. Preserve type-only imports and `/* @__NO_SIDE_EFFECTS__ */` immediately around tree-shakable plugin construction.

Ordinary public runtime inputs remain runtime-validated. TypeScript-only enforcement is a narrow exception whose seven conditions must all hold. Before removing any freeze, copy, assertion, or invariant check, classify ownership and shared execution/diagnostic references, and separate representations before optimizing when consumer mutation could affect later validation. The conditions, the ownership taxonomy, and what such a PR must document are in [the runtime-boundary policy](.claude/skills/valchecker-dev/references/runtime-boundaries.md).

## Core architecture

Schemas created by one `createValchecker()` instance share a prototype, not a `Proxy`. Fixed schema properties are own enumerable properties; registered methods are non-enumerable prototype methods. Do not reintroduce a property-read Proxy without contract review and benchmark evidence.

`allSteps` discovers runtime-marked public plugin exports. Do not maintain a duplicate static plugin list.

A normal built-in step uses `Meta` for public name, expected current state, and owned issue type; `PluginDef` for the state-aware signature and canonical JSDoc; and `implStepPlugin()` for runtime registration and operation mode. Its directory holds implementation, colocated tests, benchmark, and `index.ts`. See [architecture](.claude/skills/valchecker-dev/references/architecture.md).

## Naming and parameters

- initial schemas use nouns: `string`, `number`, `object`, `looseNumber`;
- built-in validations use natural `isXxx` propositions and preserve successful values;
- concrete transformations use `toXxx` and name the resulting representation;
- generic and flow-control operations retain direct names such as `check`, `transform`, `fallback`, `use`, `generic`, `as`, and `toAsync`.

A named validation enforces only its stated condition. Native primitive conversions delegate to `Number`, `Boolean`, or `BigInt` without hidden parsing, finite-number, integer, or precision policy; policy conversions use explicit names such as `toSafeNumber` and `toMappedBoolean`.

A message-bearing built-in keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object; positional messages are forbidden. Enforced by `scripts/check-step-parameter-style.ts`.

## Results and issues

A public failure always contains a non-empty tuple:

```ts
interface ExecutionFailureResult<Issue> {
	issues: [Issue, ...Issue[]]
}
```

Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`. Codes use `<public-step-name>:<snake_case_description>`, enforced by `scripts/check-issue-codes.ts`. Type declarations, category, payload, runtime creation, default message, tests, docs, changelog, and migration material must agree.

`createIssue()` creates an internal draft. Structures finish path, context, and enclosing message scopes; public `execute()` and Standard Schema validation finalize messages once. Message priority is: originating step message, nearest enclosing structure, outer structures, originating instance global resolver, originating step default, then `"Invalid value."`

Validation and operation failures are recoverable only where documented. Internal issues are fatal: structures stop, unions do not try another branch, and `fallback()` does not invoke its callback.

## Tests and public API

Tests protect observable runtime, type-state, interoperability, or regression contracts; coverage is a guardrail, not the test plan. For modified steps, cover distinct success/failure semantics, exact boundaries, relevant JavaScript edge cases, every owned issue shape, custom messages, output/issue inference, operation mode, and fluent availability. Add async, ordering, short-circuit, or collect-all cases only when the public contract requires them. Avoid arbitrary timers, tautologies, duplicate complete snapshots, coverage-only fixtures, and implementation-branch names. See [the testing strategy](.claude/skills/valchecker-dev/references/testing.md).

Intentional additions, removals, renames, issue/payload changes, or semantic changes must update every affected surface:

- implementation and package exports, plus `packages/internal/src/steps/index.ts`;
- `api-surface.json`, via `pnpm api:surface:update`;
- default and selective instances, and benchmark/tree-shaking scenarios;
- runtime and type tests;
- READMEs, VitePress pages, and the skills under `.claude/skills/`;
- `CHANGELOG.md`, and `MIGRATION.md` when the change is breaking.

For a built-in step, `scripts/check-step-completeness.ts` (`pnpm steps:complete`) enforces the part of that list a script can decide, and it reports every missing piece for every incomplete step at once: a colocated `<name>.test.ts` registering at least one `it` or `test`, a `<name>.bench.ts` calling `bench`, an export reaching `api-surface.json`, the step's name in call form in a code span in the `docs/api/overview.md` catalog and on one further `docs/api` page, and every owned issue code both present under `docs/api` and present in a string in one of the directory's tests. HTML comments and fenced code blocks do not count as documentation, and a comment does not count as a test.

Three of those rules are weaker than the requirement they stand for, and their messages say so: a registered test case may assert nothing, a string holding an issue code may never reach an assertion, and a page mentioning `toTrimmedStart()` may be saying it does not exist. They catch a piece going missing, not a piece going wrong — review still has to read what was written.

Then search the complete repository for superseded names, signatures, codes, commands, and paths. Documentation examples compile against the built declarations as part of `pnpm verify`, and normative prose must be traceable to implementation or tests. A fenced `ts` example that cannot compile on its own — a deliberate fragment, a removed API, or a name the page only uses illustratively — needs one of the three `<!-- typecheck-… -->` directives documented at the top of `scripts/check-docs-examples.ts`. Reach for a directive only when the example genuinely cannot compile; a failure usually means the documentation is stale.

## Pull requests

`main` is protected by a repository ruleset: no direct pushes, no force-pushes, no branch deletion, squash merge only, unresolved review threads block, and every CI check must pass. Work on a branch and open a pull request.

Use Conventional Commit intent and keep the diff focused. Open the PR ready for review once the diff is complete: the performance-impact workflow skips drafts, so a draft PR has no regression gate. Inspect the complete diff, run a review-and-fix loop, resolve actionable threads, and verify CI plus every relevant type-performance, bundle-size, and performance-impact workflow. The bundle-size and performance-impact workflows are path-filtered and therefore deliberately not required checks — read them yourself when the change touches runtime or benchmark source. Merge only when it is within requested scope.

## Issue labels

Apply at most one `type:`, one `area:`, and one `priority:`. The dimensions are orthogonal.

- `type:` — `feature`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`;
- `area:` — `core`, `step`, `all-steps`, `public-api`, `types`, `docs`, `benchmarks`, `ci`;
- `priority:` — `P0` (urgent) through `P2` (opportunistic);
- `status:` — optional workflow state such as `needs-triage`, `blocked`, or `in-progress`.

Performance issues should link durable benchmark evidence, including the run and scenario data.
