# array.spec.md

Source File: `./array.ts`

## Functionality Summary
- Validates that a value is an array and validates each item against a provided item schema

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `array`
  - Description: Creates an array schema that validates array items against a provided schema
  - Input: Item schema and optional custom message
  - Output: ArraySchema instance
- `ArraySchema`
  - Description: Schema class for array validation
  - Input: Constructor accepts schema options with item schema in meta
  - Output: ArraySchema instance

## Test Cases (as strictly required for 100% coverage)
- `array`
  - Happy Path Cases
    - [ ] case 1: Create array schema
      - Input: `array(string())`
      - Expected: Returns ArraySchema instance
  - Edge Cases
    - [ ] case 1: Validate empty array
      - Input: `schema.validate([])` where schema expects string items
      - Expected: Return success with empty array
    - [ ] case 2: Validate array with valid items
      - Input: `schema.validate(['a', 'b'])` where schema expects string items
      - Expected: Return success with the validated array
    - [ ] case 3: Validate array with invalid items
      - Input: `schema.validate(['a', 123])` where schema expects string items
      - Expected: Return failure with issues for invalid items
    - [ ] case 4: Validate non-array value
      - Input: `schema.validate('not an array')` where schema expects string items
      - Expected: Return failure with EXPECTED_ARRAY error
    - [ ] case 5: Validate array with mixed valid/invalid items
      - Input: `schema.validate(['valid', 123, 'also valid'])` where schema expects string items
      - Expected: Return failure with issue only for the invalid item at index 1
- `ArraySchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new ArraySchema({ meta: { item: string() } }).validate(['test'])`
      - Expected: Returns success result with the validated array
