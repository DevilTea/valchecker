# number.spec.md

Source File: `./number.ts`

## Functionality Summary
- Validates that a value is a number, with optional control over whether NaN values are allowed

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `number`
  - Description: Creates a number schema with optional NaN control
  - Input: Optional allowNaN boolean and/or custom message
  - Output: NumberSchema instance
- `NumberSchema`
  - Description: Schema class for number validation
  - Input: Constructor accepts schema options with allowNaN in meta
  - Output: NumberSchema instance

## Test Cases (as strictly required for 100% coverage)
- `number`
  - Happy Path Cases
    - [ ] case 1: Create number schema without parameters
      - Input: `number()`
      - Expected: Returns NumberSchema instance with allowNaN: false
    - [ ] case 2: Create number schema with custom message
      - Input: `number({ EXPECTED_NUMBER: 'Custom message' })`
      - Expected: Returns NumberSchema instance with custom message
    - [ ] case 3: Create number schema allowing NaN
      - Input: `number(true)`
      - Expected: Returns NumberSchema instance with allowNaN: true
    - [ ] case 4: Create number schema allowing NaN with custom message
      - Input: `number(true, { EXPECTED_NUMBER: 'Custom message' })`
      - Expected: Returns NumberSchema instance with allowNaN: true and custom message
  - Edge Cases
    - [ ] case 1: Validate number values (allowNaN: false)
      - Input: `schema.execute(42)` where schema doesn't allow NaN
      - Expected: Return success with the validated number
    - [ ] case 2: Validate NaN (allowNaN: false)
      - Input: `schema.execute(NaN)` where schema doesn't allow NaN
      - Expected: Return failure with EXPECTED_NUMBER error
    - [ ] case 3: Validate number values (allowNaN: true)
      - Input: `schema.execute(42)` where schema allows NaN
      - Expected: Return success with the validated number
    - [ ] case 4: Validate NaN (allowNaN: true)
      - Input: `schema.execute(NaN)` where schema allows NaN
      - Expected: Return success with NaN
    - [ ] case 5: Validate non-number values
      - Input: `schema.execute('string')` where schema doesn't allow NaN
      - Expected: Return failure with EXPECTED_NUMBER error
    - [ ] case 6: Validate special number values
      - Input: `schema.execute(Infinity)` where schema doesn't allow NaN
      - Expected: Return success with Infinity
    - [ ] case 7: Validate negative zero
      - Input: `schema.execute(-0)` where schema doesn't allow NaN
      - Expected: Return success with -0
- `NumberSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new NumberSchema({ meta: { allowNaN: false } }).execute(42)`
      - Expected: Returns success result with the value
