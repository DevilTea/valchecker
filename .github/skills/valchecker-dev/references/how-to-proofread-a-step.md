# How to Proofread a Step

This document provides a checklist for reviewing a `step` source file. The goal is to ensure steps merged into the codebase are high-quality, consistent, and correct.

This guide should be used as the standard for code reviews of any new or modified step.

## Checklist

### 1. Metadata (`Meta`) Review

- [ ] **Name**: Is the step's `Name` in its metadata correct, unique, and written in `camelCase`?
- [ ] **Context (`ExpectedThis`)**: Is the `ExpectedThis` property correctly defined to constrain the step to the appropriate validation context? (e.g., only after `v.string()`, only for `number[]`, only at the start of a chain, etc.)
- [ ] **SelfIssue**: Is the `SelfIssue` property correctly defined with all possible failure modes?
	- [ ] If the step can produce multiple issue types, is `SelfIssue` defined as a union?
	- [ ] If the step never fails, is `SelfIssue` omitted from the `Meta` definition?
- [ ] **Type Structure**: Does the `Meta` type use `DefineStepMethodMeta<{ Name, ExpectedThis, SelfIssue }>` correctly?

### 2. Issue Naming and Payloads Review

- [ ] **Naming Convention**: Do all issue `code` properties in `SelfIssue` strictly follow the `stepName:error_code` format, where `stepName` is `camelCase` and `error_code` is `snake_case`?
	- Examples: `'string:expected_string'`, `'max:expected_max'`, `'check:failed'`
- [ ] **Payloads**: Does the `payload` for each issue type contain all necessary context for generating a helpful and descriptive error message?
	- [ ] Does it include the received `value`?
	- [ ] Does it include relevant parameters (e.g., `max`, `min`, `expected`)?
	- [ ] For errors, does it include the `error` object?

### 3. Plugin Interface (`PluginDef`) Review

- [ ] **Inheritance**: Does the interface extend `TStepPluginDef`?
- [ ] **JSDoc**: Is the JSDoc for the method complete and well-written?
    - [ ] Does it have a clear `Description` section?
    - [ ] Does it include a concise and correct `Example` section with proper imports?
    - [ ] Does the `Issues` section list **all** possible issue codes the step can produce?
- [ ] **Method Signature**: Is the method signature type-safe and correct?
    - [ ] Does it use `DefineStepMethod<Meta, ...>`?
    - [ ] Does it check `this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']` for type safety?
    - [ ] For initial type validators, does it also check `IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>>`?
    - [ ] Does it return `Next<{ output, issue }, this['CurrentValchecker']>` with the correct types?
    - [ ] Does it reference `Meta['SelfIssue']` for the issue type?
- [ ] **Method Overloads**: If the step has multiple overloads, are they all defined as a union of `DefineStepMethod<>` types?

### 4. Implementation (`implStepPlugin`) Review

- [ ] **Tree-Shaking Comment**: Does the export include `/* @__NO_SIDE_EFFECTS__ */` for tree-shaking optimization?
- [ ] **Type Parameter**: Does `implStepPlugin<PluginDef>` have the correct type parameter?
- [ ] **Logic**: Is the core validation or transformation logic sound, efficient, and correct?
- [ ] **Utils Usage**: Does the implementation correctly use the `utils` object?
    - [ ] Does it destructure the needed utilities from `utils`?
    - [ ] Does it use `addSuccessStep` for success-path logic?
    - [ ] Does it use `addFailureStep` only for failure-path logic (e.g., `fallback`)?
    - [ ] Does it use `addStep` for composition (e.g., `union`, `intersection`)?
- [ ] **Error Handling**: If the step accepts a user-provided callback (e.g., in `transform`, `check`, `fallback`), are potential errors correctly handled?
    - [ ] Is there a `try...catch` block?
    - [ ] Are errors converted to a `failure` result with the appropriate issue code?
    - [ ] Are Promise rejections handled with `.catch()`?
- [ ] **Async Handling**: If the step can be asynchronous, does it correctly check for and handle `Promise` instances?
    - [ ] Does it check `result instanceof Promise`?
    - [ ] Does it use `.then()` for success and `.catch()` for errors?
- [ ] **Message Resolving**: Is `utils.resolveMessage` used to generate all user-facing error messages?
    - [ ] Does it receive the issue content as the first parameter?
    - [ ] Does it receive the custom message (from params) as the second parameter?
    - [ ] Does it receive the default message as the third parameter?
- [ ] **Return Values**: Are all paths correctly returning `ExecutionResult`?
    - [ ] Success: `success(value)`
    - [ ] Failure: `failure(issue)` or `failure([issue1, issue2, ...])`

### 5. File and Export Review

- [ ] **File Location**: Is the file located in the correct directory (`packages/valchecker/src/steps/<stepName>/<stepName>.ts`)?
- [ ] **Export**: Is the step correctly exported from the main `packages/valchecker/src/steps/index.ts` file?
- [ ] **Imports**: Are all imports correct and from the appropriate locations?
    - [ ] Core types from `'../../core'`
    - [ ] Shared utilities from `'../../shared'` (if needed)
- [ ] **Benchmarks**: Is there a corresponding `.bench.ts` file that benchmarks the step?
