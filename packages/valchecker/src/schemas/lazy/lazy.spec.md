# lazy.spec.md

Source File: `./lazy.ts`

## Functionality Summary
- Provides a "lazy" schema that defers schema creation until validation time, useful for recursive schemas or schemas with circular dependencies.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `lazy`
  - Description: Creates a lazy schema that wraps another schema
  - Input: Function that returns a schema when called
  - Output: LazySchema instance
- `LazySchema`
  - Description: Schema class for lazy validation
  - Input: Constructor accepts schema options with getSchema function
  - Output: LazySchema instance

## Test Cases (as strictly required for 100% coverage)
- `lazy`
  - Happy Path Cases
    - [ ] case 1: Create lazy schema
      - Input: `lazy(() => string())`
      - Expected: Returns LazySchema instance
  - Edge Cases
    - [ ] case 1: Validate with lazy schema
      - Input: `schema.execute('test')` where schema wraps a string schema
      - Expected: Return success with the validated value
    - [ ] case 2: Validate with invalid input
      - Input: `schema.execute(123)` where schema wraps a string schema
      - Expected: Return failure with the underlying schema's error
- `LazySchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new LazySchema({ meta: { getSchema: () => string() } }).execute('test')`
      - Expected: Returns success result with the value
