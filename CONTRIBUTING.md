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

Two git hooks run without being asked. `pre-commit` formats the staged files with ESLint.
`pre-push` runs `pnpm verify:push` — typecheck plus the quality gates, about ten seconds — because
a push here starts a benchmark comparison that costs the better part of an hour, and the class of
mistake it catches is a file the test runner executes but never typechecks. It is not a substitute
for `pnpm verify`; it is the cheap part of it, run early. Do not skip either with `--no-verify`.

## Generated files — do not hand-edit

| File | How to change it |
| --- | --- |
| `api-surface.json` | `pnpm api:surface:update`, then commit the result |
| `pnpm-lock.yaml` | let pnpm write it; never edit by hand |
| `type-performance/budget.json` | only with benchmark evidence, in its own commit, explained in the PR |
| `scripts/coverage-policy.ts` thresholds | same — never lower a threshold to make CI pass |
| `mutation-survivors.json` | `pnpm mutation:survivors:update` writes the entries; you write each classification and reason by hand, because the gate rejects an unclassified one |

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

A test that passes whether the code is right or plausibly broken is worse than a missing one, and
coverage cannot see the difference — so the repository measures it directly. The **Mutation**
workflow changes production code in small plausible ways and checks whether the suite notices. On a
pull request it does that for the files your diff touches; weekly it does the whole tree. Run the
same thing locally with `pnpm mutation:changed`, then `pnpm mutation:survivors`.

There is deliberately **no mutation-score target**. A percentage rewards killing mutants that make
no observable difference, and the only way to kill one of those is to assert an implementation
detail. The rule is that new and unclassified survivors are zero: each one is either killed by a
test, or written down with a classification (`EQUIVALENT`, `UNREACHABLE`, `PRODUCT_DECISION`,
`TOOL_ARTIFACT`), the invariant that makes it hold, and how you checked.

Three things the gate will hold you to:

- **Triage one at a time, and assume it is a real gap.** In the audit that motivated this, about
  four fifths were. Classifying a survivor because the ones around it were classified is how a
  real gap gets filed as harmless, and nothing downstream can catch that.
- **Prove every test you add for one**: watch it fail with the mutation applied and pass without it.
- **Give the invariant, not the label.** "`then(undefined)` passes the value through, so the extra
  iteration is a no-op" is a reason; "equivalent" is rejected.

Several mutants that are all equivalent for one structural reason — the arity specializations of a
single algorithm, say — belong beside the code as `// Stryker disable <mutators>: <why>` rather
than in the ledger. That directive is checked for rot too: one that no longer silences anything
fails, so an exemption cannot outlive the code it argued about.

Coverage is an unreliable way to notice that a step lost its own tests, because other steps' tests
execute it. Deleting the tests of nine steps at once, the per-file policy caught five and let four
through — `string.ts` is a four-line file that stayed at 100%. So a built-in step is required to
ship with its own `<name>.test.ts`, `<name>.bench.ts`, and `<name>.doc.md`, a public export, and
issue codes that are listed in that `<name>.doc.md` and asserted by a test in the step's directory.

A step directory is also authored to one shape, and the same gate checks it. It holds `<name>.ts`,
`<name>.test.ts`, `<name>.bench.ts`, `<name>.doc.md`, and an `index.ts` containing exactly
`export * from './<name>'` — nothing else, except an optional `<name>.types.test.ts` (which must
carry an `expectTypeOf` or `assertType` assertion, since that is the only reason for a second test
file) and `kebab-case` helper modules that `<name>.ts` actually imports, each with its own optional
test. A runtime suite that grows large stays one file with more `describe` blocks; do not add
`<name>.async.test.ts`. Inside `<name>.ts` the order is fixed: imports, then any local types, then
`type Meta`, then `interface PluginDef` with its JSDoc, then the constants and functions the runtime
uses, then `/* @__NO_SIDE_EFFECTS__ */` and the single `implStepPlugin` export as the last statement
and the file's only export. A test that spans several steps goes to
`packages/internal/src/steps/<family>.<aspect>.test.ts`, where `<family>` is not a step's name.

`pnpm steps:complete` reports everything a step is still missing in one go. What it checks is
mechanical: the files present and their names, the declaration order above, the test file registers
an `it` or `test`, the bench file calls `bench`, the export is in `api-surface.json`, the
`<name>.doc.md` entry writes the step's name in call form in a code span and carries a description
and a `ts` example, and each issue code appears in a code span of that entry and in a string in one
of the directory's tests. It cannot tell whether the test asserts anything, whether the entry says
something true, or whether a helper is used rather than merely imported, so passing it is the floor,
not the review.

`docs/api/*` is not written by hand. `<name>.doc.md` is a step's entry in the API reference, and
`pnpm docs:api:update` composes the reference from every step's entry plus the page templates under
`scripts/docs-api-templates/`, which hold the prose that belongs to no single step. `pnpm docs:api`
fails when a committed page stops matching. Each entry declares the page it belongs on (`category`)
and the section of it (`section`) in a `<!-- step-doc -->` block; both are declared rather than
guessed from the name, and anything unplaceable fails loudly.

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
