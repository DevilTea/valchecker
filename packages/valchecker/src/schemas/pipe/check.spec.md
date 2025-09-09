# check.spec.md

Source File: `./check.ts`

## Functionality Summary
- Provides a check schema system for running validation checks on values within a pipeline. Check functions can return boolean, string, or use utility functions to add custom issues or narrow types.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `CheckFn`
  - Description: Type for check functions that validate values and can return various result types
  - Input: Input type, CheckFnUtils
  - Output: void | boolean | string | True<any> | Promise of any of these
- `PipeStepCheckSchemaMessage`
  - Description: Type for schema message configuration for check schemas
  - Input: Check function type
  - Output: Schema message type
- `PipeStepCheckSchema`
  - Description: Schema class that implements check validation logic. Runs check functions and handles different return types (boolean, string, issues)
  - Input: Check function
  - Output: Validation result based on check function outcome

## Test Cases (as strictly required for 100% coverage)
- `PipeStepCheckSchema.validate`
  - Happy Path Cases
    - [ ] case 1: returns success when check function returns true
      - Input: `lastResult: { value: 'test' }`, `meta: { check: () => true }`
      - Expected: `{ value: 'test' }`
    - [ ] case 2: returns success when check function returns void (no issues added)
      - Input: `lastResult: { value: 'test' }`, `meta: { check: () => {} }`
      - Expected: `{ value: 'test' }`
    - [ ] case 3: returns failure when check function returns false
      - Input: `lastResult: { value: 'test' }`, `meta: { check: () => false }`
      - Expected: `{ issues: [{ code: 'CHECK_FAILED' }] }`
    - [ ] case 4: returns failure when check function returns string
      - Input: `lastResult: { value: 'test' }`, `meta: { check: () => 'error message' }`
      - Expected: `{ issues: [{ code: 'CHECK_FAILED', message: 'error message' }] }`
    - [ ] case 5: returns failure when check function adds issues via utils
      - Input: `lastResult: { value: 'test' }`, `meta: { check: (value, { addIssue }) => addIssue({ code: 'CUSTOM_ERROR', message: 'Custom' }) }`
      - Expected: `{ issues: [{ code: 'CUSTOM_ERROR', message: 'Custom' }] }`
    - [ ] case 6: handles async check function returning true
      - Input: `lastResult: { value: 'test' }`, `meta: { check: async () => true }`
      - Expected: `Promise<{ value: 'test' }>`
    - [ ] case 7: handles async check function returning false
      - Input: `lastResult: { value: 'test' }`, `meta: { check: async () => false }`
      - Expected: `Promise<{ issues: [{ code: 'CHECK_FAILED' }] }>`
  - Edge Cases
    - [ ] case 1: passes through failure when lastResult is already failure
      - Input: `lastResult: { issues: [...] }`, any check function
      - Expected: `{ issues: [...] }`
    - [ ] case 2: handles check function throwing synchronous error
      - Input: `lastResult: { value: 'test' }`, `meta: { check: () => { throw new Error('check error') } }`
      - Expected: `{ issues: [{ code: 'CHECK_FAILED', error: checkError }] }`
    - [ ] case 3: handles async check function rejecting
      - Input: `lastResult: { value: 'test' }`, `meta: { check: async () => { throw new Error('async check error') } }`
      - Expected: `Promise<{ issues: [{ code: 'CHECK_FAILED', error: asyncCheckError }] }>`
    - [ ] case 4: combines custom issues with CHECK_FAILED when returning false
      - Input: `lastResult: { value: 'test' }`, `meta: { check: (value, { addIssue }) => { addIssue({ code: 'CUSTOM' }); return false } }`
      - Expected: `{ issues: [{ code: 'CUSTOM' }, { code: 'CHECK_FAILED' }] }`
    - [ ] case 5: combines custom issues with CHECK_FAILED when returning string
      - Input: `lastResult: { value: 'test' }`, `meta: { check: (value, { addIssue }) => { addIssue({ code: 'CUSTOM' }); return 'message' } }`
      - Expected: `{ issues: [{ code: 'CUSTOM' }, { code: 'CHECK_FAILED', message: 'message' }] }`
