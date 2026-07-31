# Mutation Testing

Coverage asks whether execution reached a line. Mutation asks whether a plausible behavioural change to it would be noticed. In this repository those have measurably different answers: the #134/#135 audit found real defects that reading missed, and showed that several tests which looked meaningful did not discriminate the behaviour their titles claimed. Mutation is therefore permanent infrastructure here, not an audit technique someone reaches for.

Use it whenever you change production code under `packages/*/src/`, and read [testing](./testing.md) for which layer owns the assertion you end up writing.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm mutation:changed` | Mutates the production files in the diff against `origin/main`, plus the production files beside any changed test. This is the pull-request scope. |
| `pnpm mutation` | Mutates every production file in the workspace. Roughly an hour; this is the scheduled sweep. |
| `pnpm mutation:survivors` | The gate. Reads `reports/mutation/mutation.json` and fails on any survivor `mutation-survivors.json` does not classify. |
| `pnpm mutation:survivors:update` | Rewrites the ledger from the last report. New entries land as `UNTRIAGED`, which the gate rejects — writing the classification is the part no script can do. |

Point a run at one file while working: `npx stryker run --mutate 'packages/internal/src/steps/isEmail/isEmail.ts'`.

`pnpm mutation` is deliberately **not** part of `pnpm verify`. Verify is the gate you run before reporting completion, and an hour-long step would make people stop running it.

## The contract is not a score

`stryker.config.mjs` sets `thresholds.break` to null, and no percentage appears in the gate. A rule such as "mutation score >= 95%" rewards killing equivalent mutants, and the only way to kill an equivalent mutant is to assert an implementation detail — a test that pins how the code is written rather than what it promises.

The hard rule instead:

> **New and unclassified survivors must be zero.** A surviving mutant is either killed by a test, or written down with a classification, the invariant behind it, and how that was checked.

## Triaging a survivor

Every survivor is triaged **individually**. Ask which public contract is missing and which layer owns it, then place it:

| Outcome | Meaning | Where it goes |
| --- | --- | --- |
| `TEST_GAP` | The suite cannot tell correct behaviour from this broken one. | **Nowhere.** Add the smallest assertion at the owning layer and close it. |
| `EQUIVALENT` | The mutated program is observably identical. | A directive if it is part of a structural pattern, otherwise the ledger. |
| `UNREACHABLE` | No input the public API admits can execute it. | Ledger. The question it raises is whether the code should exist — a refactor decision, not a test gap. |
| `PRODUCT_DECISION` | Killing it needs the public contract decided first. | Ledger, naming the undecided question. A test written before the decision pins an accident. |
| `TOOL_ARTIFACT` | Not a plausible behavioural change at all — the runner mutated syntax that carries no behaviour. | Ledger, naming what the runner did. |
| `UNKNOWN` | Triage has not reached it. | Ledger, where it **fails the gate**. Visible beats absent. |

Three rules that are not negotiable, because each of them is a way the gate quietly stops meaning anything:

- **Assume `TEST_GAP` until you have shown otherwise.** Across the three slices triaged in #135, about four fifths were real. The estimate of one third that circulated first came from a spot check of three and was badly wrong.
- **Never classify a survivor because its neighbours were classified.** A batch verdict over a region is how a real gap gets filed as equivalent, and nothing downstream can detect it.
- **Prove every closed gap.** Watch the new test fail under the mutation and pass without it. A test that merely looks related is not evidence that it kills anything.

## Where a classification lives

**A structural pattern** — several mutants whose equivalence all follows from one stated invariant, such as the arity specializations of a single algorithm — is suppressed in place:

```ts
// Stryker disable next-line EqualityOperator: `runtimeSteps[len]` is `undefined` and `then(undefined)` passes the value through, so one extra iteration is observably this program.
for (let j = i + 1; j < len; j++)
```

The argument then sits beside the code it is about. Block form is `// Stryker disable <mutators>: <why>` … `// Stryker restore <mutators>`.

**A directive only attaches where the comment is a leading comment of the mutated node.** Two placements look right and silently do nothing:

- inside a ternary, before the branch you meant to cover;
- before an `else` or `else if`, where the comment reads as trailing the preceding block.

There is no error for this — the mutant simply comes back `Survived` with the directive sitting above it. The rot check is what catches it, reporting the directive as ignoring nothing. When you hit it, move the classification to the ledger rather than reaching for a wider block directive that would suppress neighbouring mutants you have not argued about.

**Everything else is an isolated case** and goes in `mutation-survivors.json` with its operator, location, reason and evidence.

Write the *invariant*, not the conclusion. "`then(undefined)` passes the value through, so the extra iteration is a no-op" is a reason; "equivalent" is not, and the gate rejects a reason that only restates the classification.

## Rot, in both directions

For the reason `benchmarks/src/accepted-regressions.mjs` gives about accepted regressions: a list that only grows is a place findings go to be forgotten.

- a ledger entry whose mutant is now killed **fails**, so the list shrinks as the tests improve;
- an entry naming a file that no longer exists **fails**;
- an entry with an unknown classification, or a reason or evidence that states nothing, **fails**;
- **a `// Stryker disable` directive that no longer ignores any mutant fails**, so an exemption cannot outlive the construct it argued about — the same rule, applied to the other mechanism;
- entries for files a run did not mutate are **skipped**, not confirmed and not stale. A scoped run cannot declare files it never measured to be clean.

What neither check can decide is stated in the failure text: whether the invariant a reason names is still true. Only review decides that.

## Isolation

Stryker mutates a copy under `node_modules/.stryker-tmp` and never edits the working tree. That is a requirement rather than a convenience: the hand-rolled sweep this replaced worked by editing source in place, and one of its live mutations was captured into a commit by a broad `git add` over a shared checkout, producing a "defect" and a "fix" for code that was never broken. Do not reintroduce an edit-run-restore loop in the tree you are committing from.

## Collection failure is detection

The old sweep read Vitest's collection-time failure (`no tests`) as "no test failed" and reported three killed mutants per slice as survivors. Stryker reports those as `CompileError` and `RuntimeError`; only `Survived` and `NoCoverage` count as undetected. `scripts/mutation-survivors.test.ts` pins that mapping by name so a runner or configuration change cannot quietly reinterpret it.

## What the scoped run does not cover

`scripts/mutation-scope.ts` selects changed production files and the production files beside changed tests. It does **not** compute reverse dependencies: a change to a shared module in `core/` or `shared/` can weaken discrimination in a step that imports it, and the scoped run will not mutate that step. A green pull-request gate means "this diff did not weaken the files it touched", never "the repository has no blind spots". The weekly full sweep is what covers the rest.
