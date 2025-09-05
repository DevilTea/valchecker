# object.spec.md

Source File: `./object.ts`

## Functionality Summary
- Validates that a value is an object and validates each property against a provided schema structure

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `object`
  - Description: Creates an object schema that validates object properties against a provided structure
  - Input: Object structure mapping property keys to schemas, optional custom message
  - Output: ObjectSchema instance
- `ObjectSchema`
  - Description: Schema class for object validation
  - Input: Constructor accepts schema options with struct in meta
  - Output: ObjectSchema instance

## Test Cases (as strictly required for 100% coverage)
- `object`
  - Happy Path Cases
    - [ ] case 1: Create object schema
      - Input: `object({ name: string() })`
      - Expected: Returns ObjectSchema instance
  - Edge Cases
    - [ ] case 1: Validate object with valid properties
      - Input: `schema.validate({ name: 'John' })` where schema expects name: string
      - Expected: Return success with the validated object
    - [ ] case 2: Validate object with invalid properties
      - Input: `schema.validate({ name: 123 })` where schema expects name: string
      - Expected: Return failure with issues for invalid properties
    - [ ] case 3: Validate object with missing properties
      - Input: `schema.validate({})` where schema expects name: string
      - Expected: Return failure with issues for missing properties
    - [ ] case 4: Validate object with extra properties
      - Input: `schema.validate({ name: 'John', age: 30 })` where schema expects only name: string
      - Expected: Return success (extra properties are allowed)
    - [ ] case 5: Validate non-object value
      - Input: `schema.validate('not an object')` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 6: Validate null value
      - Input: `schema.validate(null)` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 7: Validate array value
      - Input: `schema.validate([])` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
- `ObjectSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new ObjectSchema({ meta: { struct: { name: string() } } }).validate({ name: 'test' })`
      - Expected: Returns success result with the validated object
