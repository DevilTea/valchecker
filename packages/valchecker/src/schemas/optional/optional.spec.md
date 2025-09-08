# optional.spec.md

Source File: `./optional.ts`

## Functionality Summary
- Wraps a schema to make it optional, allowing undefined values
- Returns undefined when input is undefined, otherwise validates with the wrapped schema
- Supports async validation if the wrapped schema is async
- Supports schema transformations if the wrapped schema is transformed
- Provides utility functions to unwrap optional schemas and check if a schema is optional

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `optional`
  - Description: Creates an optional schema that wraps another schema
  - Input: `schema`: The schema to make optional
  - Output: OptionalSchema instance that allows undefined values
- `OptionalSchema`
  - Description: Schema class for optional validation
  - Input: Constructor accepts schema options with schema in meta
  - Output: OptionalSchema instance
- `unwrapOptional`
  - Description: Utility function to unwrap an optional schema and return the inner schema
  - Input: `schema`: Schema that may be optional
  - Output: The unwrapped schema if it was optional, otherwise the original schema
- `UnwrapOptional`
  - Description: Type utility to unwrap optional schema types
  - Input: Schema type that may be optional
  - Output: The unwrapped schema type if it was optional, otherwise the original type

## Test Cases (as strictly required for 100% coverage)
- `optional`
  - Happy Path Cases
    - [ ] case 1: Create optional schema from string schema
      - Input: `optional(string())`
      - Expected: Returns OptionalSchema instance
    - [ ] case 2: Validate undefined value with optional schema
      - Input: `schema.validate(undefined)` where schema is optional(string())
      - Expected: Return success with undefined value
    - [ ] case 3: Validate valid value with optional schema
      - Input: `schema.validate('test')` where schema is optional(string())
      - Expected: Return success with the validated value
  - Edge Cases
    - [ ] case 1: Validate null value with optional schema
      - Input: `schema.validate(null)` where schema is optional(string())
      - Expected: Return failure (null is not undefined)
    - [ ] case 2: Validate invalid value with optional schema
      - Input: `schema.validate(123)` where schema is optional(string())
      - Expected: Return failure with validation error from wrapped schema
    - [ ] case 3: Double optional wrapping
      - Input: `optional(optional(string()))`
      - Expected: Returns OptionalSchema (should unwrap the inner optional)
    - [ ] case 4: Optional with transformed schema
      - Input: `optional(transformedSchema).validate('input')`
      - Expected: Return success with transformed value
    - [ ] case 5: Optional with async schema
      - Input: `await optional(asyncSchema).validate('input')`
      - Expected: Return success after async validation
- `OptionalSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate undefined
      - Input: `new OptionalSchema({ meta: { schema: string() } }).validate(undefined)`
      - Expected: Returns success result with undefined
    - [ ] case 2: Instantiate and validate valid value
      - Input: `new OptionalSchema({ meta: { schema: string() } }).validate('test')`
      - Expected: Returns success result with validated value
  - Edge Cases
    - [ ] case 1: Validate with transformed inner schema
      - Input: `new OptionalSchema({ meta: { schema: transformedSchema } }).validate('input')`
      - Expected: Returns success result with transformed value
- `unwrapOptional`
  - Happy Path Cases
    - [ ] case 1: Unwrap optional schema
      - Input: `unwrapOptional(optional(string()))`
      - Expected: Returns the inner string schema
    - [ ] case 2: Unwrap non-optional schema
      - Input: `unwrapOptional(string())`
      - Expected: Returns the original schema unchanged
  - Edge Cases
    - [ ] case 1: Unwrap double optional
      - Input: `unwrapOptional(optional(optional(string())))`
      - Expected: Returns the inner string schema (unwrapped)
