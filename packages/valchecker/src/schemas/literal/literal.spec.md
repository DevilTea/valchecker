# literal.spec.md

Source File: `./literal.ts`

## Functionality Summary
- Validates that a value exactly matches a specific literal value (string, number, boolean, bigint, or symbol)

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `literal`
  - Description: Creates a literal schema that validates exact value matches
  - Input: Literal value and optional custom message
  - Output: LiteralSchema instance
- `LiteralSchema`
  - Description: Schema class for literal validation
  - Input: Constructor accepts schema options with literal value in meta
  - Output: LiteralSchema instance

## Test Cases (as strictly required for 100% coverage)
- `literal`
  - Happy Path Cases
    - [ ] case 1: Create literal schema with string
      - Input: `literal('hello')`
      - Expected: Returns LiteralSchema instance
    - [ ] case 2: Create literal schema with number
      - Input: `literal(42)`
      - Expected: Returns LiteralSchema instance
    - [ ] case 3: Create literal schema with boolean
      - Input: `literal(true)`
      - Expected: Returns LiteralSchema instance
    - [ ] case 4: Create literal schema with bigint
      - Input: `literal(123n)`
      - Expected: Returns LiteralSchema instance
    - [ ] case 5: Create literal schema with symbol
      - Input: `literal(Symbol('test'))`
      - Expected: Returns LiteralSchema instance
  - Edge Cases
    - [ ] case 1: Validate matching string literal
      - Input: `schema.validate('hello')` where schema expects 'hello'
      - Expected: Return success with the validated value
    - [ ] case 2: Validate matching number literal
      - Input: `schema.validate(42)` where schema expects 42
      - Expected: Return success with the validated value
    - [ ] case 3: Validate matching boolean literal
      - Input: `schema.validate(true)` where schema expects true
      - Expected: Return success with the validated value
    - [ ] case 4: Validate matching bigint literal
      - Input: `schema.validate(123n)` where schema expects 123n
      - Expected: Return success with the validated value
    - [ ] case 5: Validate matching symbol literal
      - Input: `schema.validate(sym)` where schema expects sym
      - Expected: Return success with the validated value
    - [ ] case 6: Validate NaN literal
      - Input: `schema.validate(NaN)` where schema expects NaN
      - Expected: Return success with NaN
    - [ ] case 7: Validate non-matching value
      - Input: `schema.validate('world')` where schema expects 'hello'
      - Expected: Return failure with INVALID_LITERAL error
    - [ ] case 8: Validate NaN against non-NaN literal
      - Input: `schema.validate(NaN)` where schema expects 42
      - Expected: Return failure with INVALID_LITERAL error
- `LiteralSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new LiteralSchema({ meta: { value: 'test' } }).validate('test')`
      - Expected: Returns success result with the value
