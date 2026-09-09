---
description: Look up Valchecker 1.0's cross-cutting compatibility guarantees for packages, execution, results, issues, messages, Standard Schema, structures, and plugins.
relatedSources:
  - package.json
  - packages/valchecker/package.json
  - packages/all-steps/package.json
  - packages/internal/package.json
  - SUPPORT.md
  - scripts/test-packages.ts
  - scripts/check-api-surface.ts
  - scripts/docs-api.ts
  - packages/internal/src/core/core.ts
  - packages/internal/src/core/types.ts
  - packages/internal/src/core/message.ts
  - packages/valchecker/src/default.ts
  - packages/valchecker/src/index.ts
  - packages/all-steps/src/allSteps/allSteps.ts
  - packages/internal/src/steps/object/object.ts
  - packages/internal/src/steps/strictObject/strictObject.ts
  - packages/internal/src/steps/looseObject/looseObject.ts
  - packages/internal/src/steps/array/array.ts
  - packages/internal/src/steps/set/set.ts
  - packages/internal/src/steps/map/map.ts
  - packages/internal/src/steps/record/record.ts
  - packages/internal/src/steps/tuple/tuple.ts
  - packages/internal/src/steps/union/union.ts
  - packages/internal/src/steps/variant/variant.ts
  - packages/internal/src/steps/intersection/intersection.ts
  - packages/internal/src/steps/toAsync/toAsync.ts
---
# Valchecker 1.0 Contract

This page defines the cross-cutting public contract intended for the Valchecker 1.0 release line. It is a compatibility reference, not a second tutorial or a duplicate catalog of every built-in step.

For exact parameters, issue codes, payloads, and edge cases of one built-in method, use the generated [API Reference](/api/overview). For mental models and task-oriented guidance, use [Core Concepts](/core-concepts/pipeline-and-chaining) and [Guides & Recipes](/guides-recipes/structured-data).

## Runtime and module support

| Contract | Support |
| --- | --- |
| JavaScript module format | ESM only |
| Node.js | 22 or newer |
| CommonJS | Dynamic `import('valchecker')` only |
| Synchronous `require('valchecker')` | Not supported |
| TypeScript module resolution tested in package fixtures | `NodeNext` and `Bundler` |
| Package artifacts | Runtime ESM and `.d.mts` declarations |
| Standard Schema integration | V1.1-compatible `~standard` surface |

Published tarballs are tested as installed consumer dependencies rather than only through workspace source imports. The broader lifecycle and deprecation policy is maintained in the repository's [support policy](https://github.com/DevilTea/valchecker/blob/main/SUPPORT.md).

## Package boundaries

| Package | Supported public role |
| --- | --- |
| `valchecker` | Normal application API, default `v`, built-ins, `createValchecker`, `allSteps`, and public schema/result/type helpers |
| `@valchecker/all-steps` | Complete built-in plugin collection for custom instances |
| `@valchecker/internal` | Semver-covered advanced root exports for step-plugin authors and advanced typing |

The public export manifest is `api-surface.json`. CI rejects unreviewed runtime or declaration export drift. Package-private source paths, unexported helpers, generated build internals, and private runtime markers are not public API merely because JavaScript can reach them.

## Public API compatibility

After stable 1.0, incompatible changes to semver-covered exports, accepted inputs, transformed outputs, result/issue shapes, execution semantics, structural composition, or plugin contracts require a major release unless the previous behavior contradicts the documented contract and is being corrected as a bug under the support policy.

Built-in naming communicates role:

- initial schema methods use nouns or noun phrases;
- built-in validations use `isXxx` and preserve the successful value;
- concrete transformations use `toXxx` and replace the successful value;
- generic escape hatches retain direct names such as `check` and `transform`;
- flow-control and type-level utilities use their direct semantic names.

Message-bearing methods use a trailing options object. A single required semantic operand may remain positional. Exact signatures belong to each generated API entry rather than this page.

## Schema and pipeline identity

A schema is an immutable ordered pipeline. Every fluent method returns a new schema; an existing schema is not modified by extending it.

Execution order is observable because each reached step consumes the previous result state. Transformations change the value seen by later steps, while ordinary validation failure remains a structured failure result inside the pipeline rather than becoming a thrown validation exception.

The complete model is explained in [Pipeline and Chaining](/core-concepts/pipeline-and-chaining) and [Validation and Transformation](/core-concepts/validation-and-transformation).

## Execution contract

`execute(input)` preserves the execution mode actually reached:

- a fully synchronous path returns an `ExecutionResult` directly;
- a path that reaches asynchronous or thenable work returns a native promise;
- a maybe-async pipeline may still return synchronously when an earlier failure prevents later asynchronous work from being reached.

Valchecker assimilates `PromiseLike` values for steps whose contracts permit asynchronous callbacks. `.toAsync()` is the explicit boundary that makes every invocation of the complete schema return a native promise, including synchronous success and early failure.

See [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) for the operational model. Exact async behavior of one callback step remains in that step's API entry.

## Result and issue contract

A public execution succeeds with `{ value }` or fails with a non-empty `{ issues }` tuple. Use `isSuccess()` / `isFailure()` or the result shape to discriminate the two states.

Every finalized issue exposes:

| Field | Contract |
| --- | --- |
| `code` | Stable semantic identifier owned by the originating step or core boundary |
| `category` | `validation`, `operation`, or `internal` |
| `payload` | Structured machine-readable details for that issue code |
| `message` | Resolved human-facing text |
| `path` | Data-location segments as `PropertyKey[]` |
| `context` | Optional non-data provenance such as branch context |

Validation failures are returned values. Known callback/transformation failures become the operation issues documented by their owning step. Unexpected reached execution failures are normalized to internal issues at the core boundary rather than being mislabeled as validation failures.

Issue paths are composed outward without mutating reusable child issues. Symbol path segments are preserved. [Issues and Paths](/core-concepts/issues-and-paths) owns the path/provenance mental model; generated API entries own exact issue codes and payloads.

## Message resolution

Message resolution follows this precedence:

1. custom message supplied to the originating step;
2. nearest enclosing structure message;
3. each next enclosing structure message;
4. global resolver from the Valchecker instance that originated the issue;
5. originating step default message;
6. `"Invalid value."`.

Resolution runs after the issue has its final path and context. Message maps inspect own properties only, so inherited keys are not issue-code handlers. A handler may return `null` or `undefined` to defer to the next source. A throwing message handler becomes the internal `core:message_exception` result rather than escaping the public execution boundary.

The global resolver type is derived from the plugins registered on that Valchecker instance. Selective instances therefore expose only core issues plus the issue codes of their registered plugins. Same-code payload variants remain discriminated unions, and custom plugins contribute their declared `Meta.SelfIssue` variants to that resolver domain.

For application patterns such as localization, forms, and HTTP responses, use [Custom Messages and Error Responses](/guides-recipes/custom-messages-and-errors).

## Standard Schema V1.1

Every schema exposes `~standard` through the upstream `@standard-schema/spec` V1.1 `StandardSchemaV1.Props` contract. Its `version`, `vendor`, optional phantom `types`, and `validate` properties preserve the spec's readonly declaration semantics. `validate(value, options?)` accepts the V1.1 options object; Valchecker currently ignores `options.libraryOptions`.

- synchronous validation returns a Standard Schema result directly;
- asynchronous or thenable validation returns a promise;
- success contains the transformed output;
- failure contains Standard Schema-compatible issues and paths;
- the phantom `types` member and `validate` result carry the schema output type through generic Standard Schema consumers;
- a schema with output `Output` is assignable to `StandardSchemaV1<unknown, Output>`;
- the public input type remains `unknown`, because any runtime value can be executed.

These are TypeScript declaration and interoperability guarantees, not runtime object-freezing guarantees. Use `execute()` when Valchecker's complete issue payload and Valchecker-specific result typing are required.

## Structural composition guarantees

Structural schemas validate nested data in deterministic traversal order and compose child issue locations outward. Recoverable validation/operation failures may stop traversal early by default; structures that expose `collectAllIssues` can continue through later children. Internal issues remain fatal and stop later structural work.

Different structures still own different exact contracts: unknown-object-key policy, optional fields, union branch selection, variant dispatch, intersection composition, Map/Set uniqueness, and collection paths are documented by their generated API entries. Applied object/collection composition belongs in [Structured Data](/guides-recipes/structured-data).

## Plugin and extension contract

`createValchecker({ steps })` registers the supplied plugin set in declared order. Public extension code should construct plugins through the supported root exports of `@valchecker/internal`, then register those plugin values explicitly.

Plugin methods may not collide with core-reserved names, use `then`, or use symbol method names. Registered plugins participate in the type-level schema state, issue typing, capabilities, and message resolver domain according to their public plugin metadata.

Capabilities and construction metadata are explicit composition surfaces; private imports and post-construction top-level mutations are not substitutes for those contracts. Package authors should also keep plugin modules compatible with side-effect-free bundling.

See [Custom Step Plugins](/extending/custom-step-plugins) and [Plugin Composition and Distribution](/extending/plugin-composition-and-distribution) for the supported authoring model.

## What this contract does not duplicate

The contract intentionally does not enumerate every built-in validation, transformation, parameter, or issue code. Those facts are generated from each step's colocated `.doc.md` source into the [API Reference](/api/overview).

Likewise, this page does not teach schema ordering, async control flow, issue-path reading, fallback placement, or plugin implementation from first principles. Those explanations have canonical homes in the narrative documentation so a compatibility guarantee and a teaching explanation cannot silently drift into two independently maintained versions.
