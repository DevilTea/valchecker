# Contributing to Valchecker

Thanks for contributing. This page is everything you need; you do not have to read any other
process document to open a good pull request.

## Setup

Requires Node.js 22 or newer and pnpm (the version is pinned in `package.json`).

```bash
pnpm install --frozen-lockfile
```

## The one command that matters

```bash
pnpm verify
```

That runs the complete gate — build, public API surface, packaging, lint, typecheck, tests with
coverage, and the documentation build — and it is the same set of commands CI runs. If it passes
locally, CI should agree. While working, narrower commands are faster:

```bash
pnpm test packages/internal/src/steps/isAtLeast   # one step's tests
pnpm lint --fix
pnpm typecheck
```

Some contracts are checked by separate commands because they are slow or environment-sensitive.
Run them when your change could affect them:

```bash
pnpm typeperf          # TypeScript compiler complexity budget
pnpm bench <path>      # focused runtime benchmarks
```

## Generated files — do not hand-edit

| File | How to change it |
| --- | --- |
| `api-surface.json` | `pnpm api:surface:update`, then commit the result |
| `pnpm-lock.yaml` | let pnpm write it; never edit by hand |
| `type-performance/budget.json` | only with benchmark evidence, in its own commit, explained in the PR |
| `scripts/coverage-policy.ts` thresholds | same — never lower a threshold to make CI pass |

If a gate fails, fix the code. Changing the gate is a separate, argued decision.

## Conventions worth knowing before you write code

- TypeScript strict mode; single quotes; no semicolons; tabs for indentation. `pnpm lint --fix`
  handles the mechanical part.
- **Step names carry meaning.** Initial schemas are nouns (`string`, `object`, `looseNumber`).
  Validations are `isXxx` and preserve the value on success (`isFinite`, `isAtLeast`).
  Transformations are `toXxx` and name the resulting representation (`toTrimmed`, `toJSONValue`).
  A named validation enforces only the condition its name states — it must not hide extra policy.
- **No positional message arguments.** A built-in takes at most one required operand positionally;
  optional configuration and `message` go in one trailing options object.
- **Issue codes** are `<step-name>:<snake_case_description>`, for example
  `isAtLeast:expected_at_least`.
- A public failure result always carries a non-empty issue tuple.

A change to any public behaviour needs an entry in `CHANGELOG.md` under the unreleased section. CI
enforces that the file moves when package source does; if your change genuinely needs no entry,
ask a maintainer to apply the `skip-changelog` label.

## Documentation examples are compiled

Every `ts` code fence under `docs/` is compiled against the built type declarations, so a renamed
export or changed signature fails the build instead of silently leaving the docs wrong. If you add
an example that genuinely cannot compile on its own — a fragment, a deliberately removed API, or a
name that only stands in for the reader's own code — mark it with one of the `<!-- typecheck-… -->`
directives documented at the top of `scripts/check-docs-examples.ts`. Run `pnpm docs:examples` to
check just this.

## Tests

Tests live next to the code they cover (`isAtLeast.ts` → `isAtLeast.test.ts`). A test should fail
if the behaviour it describes breaks — coverage numbers are a guardrail, not the goal. Repository
checks reject `.only`, `.skip`, raw `setTimeout`/`setInterval` in tests, and test titles named
after implementation details rather than behaviour.

Coverage is an unreliable way to notice that a step lost its own tests, because other steps' tests
execute it. Deleting the tests of nine steps at once, the per-file policy caught five and let four
through — `string.ts` is a four-line file that stayed at 100%. So a built-in step is required to
ship with its own `<name>.test.ts` and `<name>.bench.ts`, a public export, an entry in
`docs/api/overview.md` and on one further `docs/api` page, and issue codes that are documented
under `docs/api` and asserted by a test in the step's directory.

`pnpm steps:complete` reports everything a step is still missing in one go. What it checks is
mechanical: the test file registers an `it` or `test`, the bench file calls `bench`, the export is
in `api-surface.json`, the step's name appears in call form in a code span on each of those two
pages, and each issue code appears under `docs/api` and in a string in one of the directory's
tests. It cannot tell whether the test asserts anything or whether the page says something true,
so passing it is the floor, not the review.

## Pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) for the PR title, for example
  `fix(step): reject NaN in isAtLeast`. Append `!` for a breaking change.
- Keep the diff focused on one thing. Unrelated cleanups make review slower, not faster.
- Open the PR ready for review rather than as a draft — the performance-comparison workflow skips
  draft pull requests, so a draft never gets its regression check.
- The PR template asks three questions. Answering them properly is the fastest path to a merge.

`main` is protected: pull requests only, squash merge only, unresolved review threads block, and
every CI check must pass. A maintainer performs the merge once all of that is green.

## Reporting things instead

- **Bugs and feature requests:** open an issue. The templates map onto the label taxonomy
  maintainers use.
- **Security vulnerabilities:** do not open a public issue. Follow the private reporting process in
  [`SUPPORT.md`](SUPPORT.md).
- **Support boundaries, versioning, and deprecation policy:** [`SUPPORT.md`](SUPPORT.md).
