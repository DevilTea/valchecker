# intersection.spec.md

Source File: `./intersection.ts`

## Functionality Summary
- Validates that a value satisfies ALL of the provided schemas (intersection/AND operation)

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `intersection`
  - Description: Creates an intersection schema that requires a value to pass all branch validations
  - Input: Multiple schemas as branches (minimum 2)
  - Output: IntersectionSchema instance
- `IntersectionSchema`
  - Description: Schema class for intersection validation
  - Input: Constructor accepts schema options with branches array in meta
  - Output: IntersectionSchema instance

## Test Cases (as strictly required for 100% coverage)
- `intersection`
  - Happy Path Cases
    - [ ] case 1: Create intersection schema
      - Input: `intersection(string(), number())`
      - Expected: Returns IntersectionSchema instance
  - Edge Cases
    - [ ] case 1: Validate value that passes all branches
      - Input: `schema.validate('test')` where schema requires string and has length > 0
      - Expected: Return success with the validated value
    - [ ] case 2: Validate value that fails some branches
      - Input: `schema.validate(123)` where schema requires string and number
      - Expected: Return failure with issues from failing branches
    - [ ] case 3: Validate value that fails all branches
      - Input: `schema.validate(true)` where schema requires string and number
      - Expected: Return failure with issues from all branches
    - [ ] case 4: Validate with empty intersection (should not be possible due to type constraints)
      - Input: N/A (type system prevents empty intersections)
      - Expected: N/A
- `IntersectionSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new IntersectionSchema({ meta: { branches: [string(), number()] } }).validate('test')`
      - Expected: Returns success result with the value
