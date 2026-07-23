# Step Implementation Architecture

This document explains the three-layer pattern used by all validation steps in Valchecker.

## Overview

Every validation step follows a strict three-layer pattern:

1. **Meta** - Type metadata definition
2. **PluginDef** - TypeScript interface with JSDoc
3. **Implementation** - Runtime validation logic

## Layer 1: Meta (Type Metadata)

Defines the step's type information for TypeScript inference:

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'stepName'                              // Method name in chain
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: InputType }>  // Required input type
  SelfIssue: ExecutionIssue<'stepName:issue_code', { value: unknown }>  // Issue type
}>
```

**Key Points:**
- `Name`: The method name users will call (e.g., `'min'`, `'toTrimmed'`)
- `ExpectedCurrentValchecker`: What input type this step expects
- `SelfIssue`: The issue type this step can produce (or `never` for non-failing transforms). Two generic arguments default to category `validation`; pass `operation` or `internal` explicitly when appropriate.

## Layer 2: PluginDef (TypeScript Interface)

Defines the method signature with comprehensive JSDoc documentation:

```typescript
interface PluginDef extends TStepPluginDef {
  /**
   * ### Description:
   * Brief explanation of what the step does.
   *
   * ---
   *
   * ### Example:
   * ```ts
   * const v = createValchecker({ steps: [string, myStep] })
   * const schema = v.string().myStep()
   * ```
   *
   * ---
   *
   * ### Issues:
   * - `'stepName:issue_code'`: When this issue occurs.
   */
  stepName: DefineStepMethod<
    Meta,
    this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
      ? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
          { output: OutputType, issue: Meta['SelfIssue'] },
          this['CurrentValchecker']
        >
      : never
  >
}
```

**JSDoc Sections:**
- **Description**: What the step does
- **Example**: Code showing how to use it
- **Issues**: List of error codes this step can produce

## Layer 3: Implementation (Runtime Logic)

Implements the actual validation using `implStepPlugin`:

```typescript
/* @__NO_SIDE_EFFECTS__ */
export const stepName = implStepPlugin<PluginDef>({
  stepName: ({
    utils: { addSuccessStep, success, createIssue, failure },
    params: [message],
  }) => {
    addSuccessStep((value) => {
      if (/* validation passes */) {
        return success(value)  // or success(transformedValue)
      }
      return failure(
        createIssue({
          code: 'stepName:issue_code',
          payload: { value },
          customMessage: message,
          defaultMessage: 'Default error message.',
        }),
      )
    })
  },
}, 'sync')
```

**Important Notes:**
- Always use `/* @__NO_SIDE_EFFECTS__ */` for tree-shaking
- `implStepPlugin()` defaults unannotated custom plugins to `maybe-async`. Pass `'sync'` only when every unannotated runtime callback in that plugin is contractually synchronous; individual `addStep()` calls may still override the mode.
- Register validation with `addSuccessStep()` or `addFailureStep()`
- Use `success()` to pass values, `failure()` to report one or more issues; failure arrays must be non-empty
- Return transformed values in `success()` for transform steps

## Common Patterns

### Constraint Step (No Type Change)

Steps that validate but don't change the type (like `min`, `max`):

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'positive'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
  SelfIssue: ExecutionIssue<'positive:expected_positive', { value: number }>
}>

// In PluginDef: () => Next<{ issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
```

### Transform Step (Type Changes)

Steps that modify the output type (like `toTrimmed`, `transform`):

```typescript
type Meta = DefineStepMethodMeta<{
  Name: 'toArray'
  ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
  SelfIssue: never  // Transforms typically don't fail
}>

// In PluginDef: () => Next<{ output: string[] }, this['CurrentValchecker']>
```

### Recovery Step (Failure Handler)

Steps that catch failures (like `fallback`):

```typescript
addFailureStep((issues) => {
  if (hasInternalIssue(issues))
    return failure(issues)      // Internal failures are fatal
  return success(defaultValue) // Recover validation/operation failures
})
```

### Multi-Type Step

Steps that work with multiple input types (like `min` for number/bigint/string.length):

See `packages/internal/src/steps/min/min.ts` for a complete example of handling multiple types.

A multi-variant step exposes its call signatures as a `DefineStepMethod` union, and the implementation layer recovers each variant's `params` and return type through the `OverloadParametersAndReturnType` / `OverloadReturnType` ladder in `shared.ts` (currently 8 deep). The ladder **silently drops the first overload** once the variant count exceeds its depth — there is no compile error. Keep every step at or below `depth − 1` call signatures; the sentinel type test in `shared/shared.types.test.ts` guards the current maximum.


## Issue typing and finalization

`createIssue()` is type-checked against the current method's `Meta.SelfIssue`. A code typo, incompatible payload, or incompatible category must fail typechecking. Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`.

Issue drafts remain internal while nested structures prepend paths and message scopes. Public `execute()` and Standard Schema validation finalize each issue once. Do not eagerly call message handlers in a step implementation.

### Draft-metadata propagation

A draft issue's unresolved message metadata lives on a non-enumerable symbol. A hand-written `{ ...issue }` spread silently drops that metadata and freezes the copy at the step's default message (not `'Invalid value.'`). On any propagation path, clone issues through the `prependIssuePath` / `appendIssueContext` helpers rather than spreading. Diagnostic payload snapshots that intentionally spread — for example `fallback`'s `receivedIssues` — therefore carry the unresolved default message; that is documented behavior, and the issues actually returned to the caller finalize normally.

### Message precedence

The message tier order — custom → context → global → default → `'Invalid value.'` — is encoded across three cross-linked core functions: `resolveMessagePriority`, `resolveStaticIssueMessage`, and `getInitialIssueMessage`, plus the `hasDynamicMessageForCode` classifier. Adding, removing, or reordering a tier requires changing all three in lockstep and updating the matrix test in `message-contracts.test.ts`; a missed site silently resolves the wrong tier or freezes the wrong message.


## Structural and combinator failure rules

Object-family steps must distinguish `Object.hasOwn(value, key)` from the property's value. Missing required keys use the variant-specific `missing_key` issue; present `undefined` runs the child schema. Optional missing keys skip the child and still materialize `undefined` in the declared output.

Within the internal package, use the package-private `hasInternalIssue()` / `isRecoverableFailure()` helpers for category-based propagation on cold paths. Do not branch on issue-code strings. Union adds branch provenance to `context`, not `path`; fallback must preserve received issues when its callback fails.

Inside the hot child-issue collection loop, the `category === 'internal'` check is instead fused inline with the single-pass path-prepend; routing it through `isRecoverableFailure()` would force a second traversal of the child issues. `isRecoverableFailure()` remains the correct choice for step authors writing recovery logic on non-hot paths.

### Deliberate performance duplication

Do not "clean up" the following duplication. Each pattern was measured and the shared-abstraction alternative was rejected.

- **Per-file child-issue collection loop.** The single-pass loop that prepends the child path and detects an internal issue in one traversal is duplicated per file across `object`, `strictObject`, `looseObject`, `array`, `map`, `set`, and `intersection`, with the same-shaped inline loop in `union` and `variant` (nine sites). Extracting it into a shared cross-module helper was implemented and benchmarked on 2026-07-22: −12% (Set) / −13% (Map) ops/sec on the recoverable-failure hot path, because V8 inlines the per-schema local closure but not a shared cross-module helper. It was reverted. Each site carries a one-line marker comment.
- **`map` / `set` doomed-output rebuild.** In `collectAllIssues` mode, after a recoverable child failure the lazy output structure MUST keep being built even though the final result will be a failure: the output structure doubles as the duplicate-detection state, and skipping the rebuild loses `set:duplicate_transformed_item` / `map:duplicate_transformed_key` issues (verified empirically 2026-07-22). Do not drop to an issue-only loop after the first failure. (A failed entry is never added to the buffer or output, so later duplicate detection compares only successful entries — the doomed-output requirement is that dup detection keeps running across failures, not that failed entries are retained.)

## Instance dispatch: shared prototype, not a Proxy

Every schema instance is `Object.create(familyPrototype)` with the fixed properties (`~standard`, `~core`, `~execute`, `execute`, `isSuccess`, `isFailure`) installed as own, enumerable properties, and the registered step methods installed once as non-enumerable properties on the per-family prototype. An earlier design wrapped a plain core-properties object in a `Proxy` whose only job was a `get` trap that lazily resolved step methods. That trap ran on **every** property read, including the hot `execute`, `~execute`, and `~core` paths that structural steps read for each child schema, adding a fixed per-access cost with nothing else to gain. Measured on 2026-07-23: primitive `execute` 39.6ns → 11.5ns and a raw `~execute` read 39ns → 6.8ns. Keep step methods on the prototype (non-enumerable, so `for...in` and spreads stay clean) and read per-instance `runtimeSteps` / `operationMode` from `this['~core']`; do not reintroduce a `get`-trap Proxy for lazy method resolution.

## Collection iteration: live native iterator, no snapshot

`map` and `set` iterate the native `Map.prototype.entries` / `Set.prototype.values` iterator lazily rather than snapshotting all entries up front. A first-issue short-circuit therefore does O(1) work instead of O(n) (measured map first-invalid ~820ns → ~26ns, 2026-07-23). Consequences that are intentional and must be preserved: (1) using the captured native iterator ignores an overridden instance `forEach`/`entries`/`values`, so a tampered instance cannot redirect validation away from its real contents; (2) there is no mutation-isolation guarantee — a child step that mutates the input during validation observes the same live iteration as the underlying collection iterator, matching valibot/zod. The synchronous fast path buffers consumed identity entries and materializes the output collection only when a transform first differs, so the all-identity valid path still allocates the output once (not per entry).
