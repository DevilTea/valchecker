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

Every public built-in method carries canonical JSDoc sections in this order:

1. `### Description:`
2. `### Example:`
3. `### Issues:`

Message-bearing built-ins use `StepOptions<Issue>` or a step-specific options object containing `message`; positional message parameters are not allowed.

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

Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`. Failure results contain a non-empty issue tuple.

## Structural execution

Structural steps precompute child executors and operation mode at construction. They use a synchronous fast path while every reached child result is synchronous and continue sequentially after a thenable unless the individual combinator documents a different collect-all strategy.

Validation and operation failures are recoverable according to the structure's first/all policy. Internal issues are fatal and stop later work immediately.

Object-family steps distinguish a missing own property from an own property whose value is `undefined`. Optional object fields are represented by a one-element tuple and still materialize an output property with `undefined` when absent.

Map and Set schemas iterate captured native iterators lazily. They do not promise mutation isolation during child validation. Their synchronous identity path delays output materialization until needed, and collect-all mode must continue building duplicate-detection state after recoverable failures.

## Construction metadata

`utils.setMetadata(symbol, value)` writes a symbol-keyed entry to `~core.metadata` for the schema currently being built. Metadata describes only the final step and is dropped by the next fluent call unless that step redeclares it.

Metadata keys are well-known symbols owned by the declaring step module and imported cross-step by direct relative path. Mutable metadata that can affect later validation must be snapshotted or frozen by its owner.

Type-level metadata is represented by explicit optional `TExecutionContext` fields only when a type-system consumer exists; it is not a generic symbol map.

## Public-step integration

A normal built-in step has:

```text
packages/internal/src/steps/<name>/
├── <name>.ts
├── <name>.test.ts
├── <name>.bench.ts
└── index.ts
```

Additional type, async, collect-all, or regression tests remain colocated. Export the plugin from its local `index.ts` and `packages/internal/src/steps/index.ts`, then update every affected public/test/docs/benchmark surface listed in `AGENTS.md`.
