# Step Implementation Architecture

## Schema construction and dispatch

`createValchecker()` registers step plugins and creates one prototype shared by every schema built from that Valchecker instance. Fixed schema properties (`~standard`, `~core`, `~execute`, `execute`, `isSuccess`, `isFailure`) are own enumerable properties. Registered step methods are installed once as non-enumerable prototype methods. Schema dispatch is not implemented with a `Proxy`.

Every fluent call creates a new schema and a fresh construction utility object. Runtime pipelines and construction metadata are therefore immutable-by-replacement rather than mutated in place.

`allSteps` scans public exports for the runtime plugin marker. Adding a built-in plugin requires exporting it through the normal barrels; no second static list is maintained.

## The three plugin layers

### `Meta`

`DefineStepMethodMeta` declares:

- `Name`: public fluent method name;
- `ExpectedCurrentValchecker`: the schema state in which the method is available;
- `SelfIssue`: the issues owned by the step, when any.

Two-argument `ExecutionIssue<Code, Payload>` defaults to category `validation`. Pass `operation` or `internal` explicitly when required.

### `PluginDef`

`PluginDef extends TStepPluginDef` defines the state-aware TypeScript method. It uses `DefineStepMethod`, checks the current schema against `ExpectedCurrentValchecker`, and returns `Next<...>` patches for output, issue, and operation mode.

Message-bearing built-ins take `StepOptions<Issue>` or a step-specific options object containing `message`. Canonical JSDoc structure is in [conventions](./conventions.md#canonical-jsdoc).

### Runtime implementation

`implStepPlugin<PluginDef>()` maps each public method to its constructor-time implementation. Use:

- `addSuccessStep()` for work reached only on success;
- `addFailureStep()` for recovery work reached only on failure;
- `addStep()` when the operation handles either result state;
- `success()` and `failure()` to return step results;
- `createIssue()` for issues owned by the current method.

Unannotated plugins default conservatively to runtime `maybe-async`. Pass `'sync'` to `implStepPlugin()` only when every registration that inherits the default is guaranteed not to return a thenable. Individual registrations may override the plugin default with `'sync'`, `'maybe-async'`, or `'async'`.

## Issue drafts and finalization

`createIssue()` creates a typed draft. It does not eagerly run dynamic message handlers. Nested structures clone issues while prepending paths, appending provenance context, and attaching enclosing message scopes. Public `execute()` and Standard Schema validation finalize each issue exactly once.

Do not spread an issue on a propagation path: draft metadata is stored on a non-enumerable symbol and a spread drops it. Use `prependIssuePath`, `replaceIssuePath`, and `appendIssueContext` from the step utilities.

## Structural execution

Structural steps precompute child executors and operation mode at construction. They use a synchronous fast path while every reached child result is synchronous and continue sequentially after a thenable unless the individual combinator documents a different collect-all strategy.

Validation and operation failures are recoverable according to the structure's first/all policy. Internal issues are fatal and stop later work immediately.

Object-family steps distinguish a missing own property from an own property whose value is `undefined`. Optional object fields are represented by a one-element tuple and still materialize an output property with `undefined` when absent.

Map and Set schemas iterate captured native iterators lazily. They do not promise mutation isolation during child validation. Their synchronous identity path delays output materialization until needed, and collect-all mode must continue building duplicate-detection state after recoverable failures.

## Construction metadata

`utils.setMetadata(symbol, value)` writes a symbol-keyed entry to `~core.metadata` for the schema currently being built. Metadata describes only the final step and is dropped by the next fluent call unless that step redeclares it.

Metadata keys are well-known symbols owned by the declaring step module and imported cross-step by direct relative path. Mutable metadata that can affect later validation must be snapshotted or frozen by its owner.

Type-level metadata is represented by explicit optional `TExecutionContext` fields only when a type-system consumer exists; it is not a generic symbol map.

## Plugin capabilities

A capability lets one step discover what another registered step can do without importing it. It is declared as the third argument of `implStepPlugin`, keyed by a well-known symbol, and read by any step of the same instance through `context.getCapabilities(symbol)` in registration order. `union` resolves its shorthand branches this way, so a third-party plugin can add a branch kind.

Declare a capability inside the `implStepPlugin` call. A top-level declaration statement after it is dropped by the bundler as an unused side effect, and the capability then exists in source but not in the published build.

The type-state half goes under the plugin def's `Capabilities` slot, never at the top level, where it would be read as a step method name and surface in `core:unknown_exception`'s `payload.method`.

## Public-step integration

What a step directory holds, how its auxiliary tests and helper modules are named, and the order of the sections inside `<name>.ts` are one standard, written down in [the step unit](./step-unit.md). Export the plugin from its local `index.ts` and `packages/internal/src/steps/index.ts`, then update every affected surface listed in [`AGENTS.md`](../../../../AGENTS.md#tests-and-public-api).

`scripts/check-step-completeness.ts` fails on a step that departs from that standard, and reports every problem for every step in one message. Beyond the file set and the section order it requires the test file to register at least one `it` or `test` and the bench file to call `bench`, the export to reach `api-surface.json`, the `<name>.doc.md` entry to write the step's name in call form in a code span and carry a description and a `ts` example, and each owned issue code to appear in a code span of that entry and in a string in one of the directory's tests. Fenced code blocks and HTML comments are stripped from Markdown before matching, and TypeScript strings come from the parsed AST, so a `<!-- TODO -->` or a `// FIXME` satisfies nothing. `docs/api/*` is generated from those entries by `scripts/docs-api.ts`; `pnpm docs:api` is what fails when a step cannot be placed on a page or a committed page stops matching.

What it cannot decide is whether any of that says something true: a registered case may assert nothing, a string holding an issue code may never reach an assertion, and a page may mention a step in a sentence denying it exists. Nor can it place a local *type* in the right section, since a contract type and an implementation type are the same syntax. Its failure messages state that rather than implying more, and `scripts/step-completeness.test.ts` pins each of those limits alongside the rule it belongs to.

The rules it leaves to other gates — `Meta.Name`, the JSDoc template, the parameter style, `index.ts` resolution, the runtime `code:` literal, and the cross-library scenario — are listed in the comment at the top of `scripts/step-completeness.ts`. The set of steps itself comes from `scripts/step-inventory.ts`, shared with `check-issue-codes` and `check-benchmark-coverage`: a step directory whose implementation is not `<name>.ts`, or one the barrel and the directory scan disagree about, fails all three instead of dropping out of the count.
