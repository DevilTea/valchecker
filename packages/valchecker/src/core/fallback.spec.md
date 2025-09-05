# fallback.spec.md

Source File: `./fallback.ts`

## Functionality Summary
- Provides a fallback step for validation chains. If the previous validation fails, it executes a fallback function and returns its result as a success, or returns a failure with code `FALLBACK_FAILED` if the fallback throws/rejects.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `FallbackFn`
  - Description: Type for a function returning a value or Promise as fallback.
  - Input: None
  - Output: `T | Promise<T>`
- `PipeStepFallbackSchemaMessage`
  - Description: Type for schema message config for fallback schema.
- `PipeStepFallbackSchema`
  - Description: Schema class implementing fallback logic. If previous result is success, passes through. If failure, runs fallback and returns its result as success, or failure if fallback throws/rejects.

## Test Cases (as strictly required for 100% coverage)
- `PipeStepFallbackSchema.validate`
  - Happy Path Cases
    - [ ] case 1: returns original success if lastResult is success
      - Input: `lastResult: { value: 'ok' }`, `meta: { fallback: () => 'fallback' }`
      - Expected: `{ value: 'ok' }`
    - [ ] case 2: returns success with sync fallback if lastResult is failure
      - Input: `lastResult: { issues: [...] }`, `meta: { fallback: () => 'fallback' }`
      - Expected: `{ value: 'fallback' }`
    - [ ] case 3: returns success with async fallback if lastResult is failure
      - Input: `lastResult: { issues: [...] }`, `meta: { fallback: async () => 'async' }`
      - Expected: `{ value: 'async' }`
  - Error Cases
    - [ ] case 1: returns failure if sync fallback throws
      - Input: `lastResult: { issues: [...] }`, `meta: { fallback: () => { throw new Error('fail') } }`
      - Expected: `{ issues: [{ code: 'FALLBACK_FAILED', error: ... }] }`
    - [ ] case 2: returns failure if async fallback rejects
      - Input: `lastResult: { issues: [...] }`, `meta: { fallback: async () => { throw new Error('fail') } }`
      - Expected: `{ issues: [{ code: 'FALLBACK_FAILED', error: ... }] }`
