# bigint.spec.md

Source File: `./bigint.ts`

## Functionality Summary
- Provides a "bigint" schema that validates if the input is a bigint value.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `bigint`
  - Description: Creates a bigint schema instance
  - Input: Optional message parameter
  - Output: BigintSchema instance
- `BigintSchema`
  - Description: Schema class for bigint type validation
  - Input: Constructor accepts schema options
  - Output: BigintSchema instance

## Test Cases (as strictly required for 100% coverage)
- `bigint`
  - Happy Path Cases
    - [ ] case 1: Create bigint schema without parameters
      - Input: `bigint()`
      - Expected: Returns BigintSchema instance
    - [ ] case 2: Create bigint schema with custom message
      - Input: `bigint({ EXPECTED_BIGINT: 'Custom message' })`
      - Expected: Returns BigintSchema instance with custom message
  - Edge Cases
    - [ ] case 1: Validate bigint values
      - Input: `schema.validate(123n)`, `schema.validate(BigInt(456))`
      - Expected: All return success with the bigint value
    - [ ] case 2: Validate non-bigint values
      - Input: `schema.validate(123)`, `schema.validate('string')`, `schema.validate(null)`, `schema.validate({})`
      - Expected: All return failure with EXPECTED_BIGINT issue
- `BigintSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new BigintSchema().validate(789n)`
      - Expected: Returns success result with the value
