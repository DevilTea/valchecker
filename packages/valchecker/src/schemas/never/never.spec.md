# never.spec.md

Source File: `./never.ts`

## Functionality Summary
- Provides a "never" schema that always fails validation, useful for cases where a value should never be reached.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `never`
  - Description: Creates a never schema instance
  - Input: Optional message parameter
  - Output: NeverSchema instance
- `NeverSchema`
  - Description: Schema class for never type validation
  - Input: Constructor accepts schema options
  - Output: NeverSchema instance

## Test Cases (as strictly required for 100% coverage)
- `never`
  - Happy Path Cases
    - [ ] case 1: Create never schema without parameters
      - Input: `never()`
      - Expected: Returns NeverSchema instance
    - [ ] case 2: Create never schema with custom message
      - Input: `never({ EXPECTED_NEVER: 'Custom message' })`
      - Expected: Returns NeverSchema instance with custom message
  - Edge Cases
    - [ ] case 1: Validate any value
      - Input: `schema.execute(anyValue)` for various types
      - Expected: Always return failure with EXPECTED_NEVER issue
- `NeverSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new NeverSchema().execute('test')`
      - Expected: Returns failure result with EXPECTED_NEVER issue
