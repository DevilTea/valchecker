# union.spec.md

Source File: `./union.ts`

## Functionality Summary
- Validates that a value satisfies AT LEAST ONE of the provided schemas (union/OR operation)

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `union`
  - Description: Creates a union schema that requires a value to pass at least one branch validation
  - Input: Multiple schemas as branches (minimum 2)
  - Output: UnionSchema instance
- `UnionSchema`
  - Description: Schema class for union validation
  - Input: Constructor accepts schema options with branches array in meta
  - Output: UnionSchema instance

## Test Cases (as strictly required for 100% coverage)
- `union`
  - Happy Path Cases
    - [ ] case 1: Create union schema
      - Input: `union(string(), number())`
      - Expected: Returns UnionSchema instance
  - Edge Cases
    - [ ] case 1: Validate value that passes first branch
      - Input: `schema.execute('test')` where schema accepts string or number
      - Expected: Return success with the validated value from first matching branch
    - [ ] case 2: Validate value that passes second branch
      - Input: `schema.execute(42)` where schema accepts string or number
      - Expected: Return success with the validated value from second matching branch
    - [ ] case 3: Validate value that fails all branches
      - Input: `schema.execute(true)` where schema accepts string or number
      - Expected: Return failure with issues from all branches
    - [ ] case 4: Validate value that passes multiple branches
      - Input: N/A (union returns result from first successful branch)
      - Expected: N/A
- `UnionSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new UnionSchema({ meta: { branches: [string(), number()] } }).execute('test')`
      - Expected: Returns success result with the value
