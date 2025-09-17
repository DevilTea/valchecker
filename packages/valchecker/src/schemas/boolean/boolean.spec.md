# boolean.spec.md

Source File: `./boolean.ts`

## Functionality Summary
- Provides a "boolean" schema that validates if the input is a boolean value.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `boolean`
  - Description: Creates a boolean schema instance
  - Input: Optional message parameter
  - Output: BooleanSchema instance
- `BooleanSchema`
  - Description: Schema class for boolean type validation
  - Input: Constructor accepts schema options
  - Output: BooleanSchema instance

## Test Cases (as strictly required for 100% coverage)
- `boolean`
  - Happy Path Cases
    - [ ] case 1: Create boolean schema without parameters
      - Input: `boolean()`
      - Expected: Returns BooleanSchema instance
    - [ ] case 2: Create boolean schema with custom message
      - Input: `boolean({ EXPECTED_BOOLEAN: 'Custom message' })`
      - Expected: Returns BooleanSchema instance with custom message
  - Edge Cases
    - [ ] case 1: Validate boolean values
      - Input: `schema.execute(true)`, `schema.execute(false)`
      - Expected: All return success with the boolean value
    - [ ] case 2: Validate non-boolean values
      - Input: `schema.execute(1)`, `schema.execute('string')`, `schema.execute(null)`, `schema.execute({})`
      - Expected: All return failure with EXPECTED_BOOLEAN issue
- `BooleanSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new BooleanSchema().execute(true)`
      - Expected: Returns success result with the value
